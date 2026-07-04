const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const { generateServerModification } = require('../ai.js');
const { handleUndo } = require('../undoManager.js');

// Temporary store for generated modifications pending confirmation
const pendingModifications = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modify')
        .setDescription('Existing server ko AI instructions se modify karein')
        .addStringOption(option =>
            option.setName('instructions')
                .setDescription('Kya add/change karna chahte hain? (e.g., Add a VIP role and chat)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            const instructions = interaction.options.getString('instructions');
            
            const guild = interaction.guild;
            
            // 1. Scan current structure
            await guild.roles.fetch();
            await guild.channels.fetch();

            const currentStructure = {
                roles: [],
                categories: []
            };

            const roles = guild.roles.cache.filter(r => !r.managed && r.id !== guild.id).sort((a, b) => b.position - a.position);
            roles.forEach(r => {
                currentStructure.roles.push({
                    name: r.name,
                    color: r.hexColor,
                    permissions: r.permissions.toArray()
                });
            });

            const categories = guild.channels.cache.filter(c => c.type === 4); 
            const channels = guild.channels.cache.filter(c => c.type !== 4);

            const uncategorizedChannels = channels.filter(c => !c.parentId).map(c => ({
                name: c.name,
                type: c.type === 2 ? 'voice' : 'text'
            }));

            if (uncategorizedChannels.length > 0) {
                currentStructure.categories.push({
                    name: 'Uncategorized',
                    channels: uncategorizedChannels
                });
            }

            categories.forEach(cat => {
                const catChannels = channels.filter(c => c.parentId === cat.id).map(c => ({
                    name: c.name,
                    type: c.type === 2 ? 'voice' : 'text'
                }));
                currentStructure.categories.push({
                    name: cat.name,
                    channels: catChannels
                });
            });
            
            await interaction.editReply({ content: 'Server scan ho gaya, AI modifications generate kar raha hai...' });

            // 2. Call AI with current context
            const modificationStructure = await generateServerModification(currentStructure, instructions);
            
            // Validate the structure safely
            if (!modificationStructure.roles && !modificationStructure.categories) {
                throw new Error("AI ne koi modifications return nahi kiye.");
            }

            pendingModifications.set(interaction.user.id, modificationStructure);

            let rolesText = (modificationStructure.roles || []).map(r => `- ${r.name} (${r.color || 'Default'})`).join('\n') || 'Koi naye roles nahi';
            let channelsText = (modificationStructure.categories || []).map(cat => {
                let text = `**${cat.name}**\n`;
                if (cat.channels) {
                    text += cat.channels.map(ch => `  ↳ ${ch.name} (${ch.type})`).join('\n');
                }
                return text;
            }).join('\n\n') || 'Koi naye channels nahi';

            const embed = new EmbedBuilder()
                .setTitle('Server Modification Preview')
                .setDescription('Niche diye gaye NAYE roles aur channels server mein add kiye jayenge. Purane roles aur channels delete nahi honge:')
                .addFields(
                    { name: 'Naye Roles (Add Honge)', value: rolesText.substring(0, 1024) },
                    { name: 'Naye Categories & Channels (Add Honge)', value: channelsText.substring(0, 1024) }
                )
                .setColor('#2ecc71');

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('modify_confirm')
                        .setLabel('Confirm Modifications')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('modify_cancel')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Danger),
                );

            await interaction.editReply({ content: '', embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Modify Error:', error);
            await interaction.editReply({ content: `Modify fail ho gaya: ${error.message}`, embeds: [], components: [] });
        }
    },

    async handleButton(interaction) {
        if (!interaction.customId.startsWith('modify_')) return;
        
        try {
            const action = interaction.customId.split('_')[1];
            
            if (action === 'cancel') {
                pendingModifications.delete(interaction.user.id);
                await interaction.update({ content: 'Modification cancel ho gaya.', embeds: [], components: [] });
                return;
            }

            if (action === 'confirm') {
                const structure = pendingModifications.get(interaction.user.id);
                if (!structure) {
                    return interaction.update({ content: 'Session expire ho gaya hai, kripya dobara /modify run karein.', embeds: [], components: [] });
                }

                await interaction.update({ content: 'Modifications apply ho rahe hain... Kripya wait karein.', embeds: [], components: [] });
                
                const guild = interaction.guild;
                
                const createdRoles = [];
                const createdChannels = [];
                const failedItems = [];
                
                const delay = ms => new Promise(res => setTimeout(res, ms));

                // Create Roles
                for (const roleData of structure.roles || []) {
                    console.log(`Creating role: ${roleData.name}...`);
                    try {
                        const permissionsArray = (roleData.permissions || []).map(p => typeof p === 'string' ? PermissionsBitField.Flags[p] : p).filter(Boolean);
                        
                        const newRole = await guild.roles.create({
                            name: roleData.name,
                            color: roleData.color || undefined,
                            permissions: permissionsArray,
                            reason: 'AI Server Modification',
                        });
                        createdRoles.push(newRole.id);
                        await interaction.followUp({ content: `Naya Role \`${roleData.name}\` ban gaya!`, ephemeral: true });
                    } catch (err) {
                        console.log(`Creating role: ${roleData.name}... Failed: ${err.message}`);
                        failedItems.push(`Role: ${roleData.name}`);
                    }
                    await delay(400); // 400ms delay to avoid rate limits
                }

                // Create Categories and Channels
                for (const catData of structure.categories || []) {
                    console.log(`Processing category: ${catData.name}...`);
                    let categoryId = null;
                    
                    // Check if category already exists
                    let existingCategory = guild.channels.cache.find(c => c.type === 4 && c.name.toLowerCase() === catData.name.toLowerCase());
                    
                    if (existingCategory) {
                        categoryId = existingCategory.id;
                    } else if (catData.name !== 'Uncategorized') {
                        try {
                            const category = await guild.channels.create({
                                name: catData.name,
                                type: ChannelType.GuildCategory,
                                reason: 'AI Server Modification',
                            });
                            createdChannels.push(category.id);
                            categoryId = category.id;
                        } catch (err) {
                            console.log(`Creating category: ${catData.name}... Failed: ${err.message}`);
                            failedItems.push(`Category: ${catData.name}`);
                        }
                        await delay(400);
                    }
                    
                    for (const chData of catData.channels || []) {
                        console.log(`Creating channel: ${chData.name}...`);
                        try {
                            const cType = chData.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
                            const newChannel = await guild.channels.create({
                                name: chData.name,
                                type: cType,
                                parent: categoryId, // Will place in existing or new category
                                reason: 'AI Server Modification',
                            });
                            createdChannels.push(newChannel.id);
                        } catch (err) {
                            console.log(`Creating channel: ${chData.name}... Failed: ${err.message}`);
                            failedItems.push(`Channel: ${chData.name}`);
                        }
                        await delay(400);
                    }
                }

                pendingModifications.delete(interaction.user.id);
                
                const totalCreated = createdRoles.length + createdChannels.length;
                let summaryMsg = `✅ Modification complete! ${totalCreated} naye items create hue.`;
                if (failedItems.length > 0) {
                    summaryMsg += `\n⚠️ ${failedItems.length} items fail hue:\n- ${failedItems.join('\n- ')}`;
                }
                
                try {
                    await interaction.followUp({ content: summaryMsg, ephemeral: true });
                } catch (finalError) {
                    try {
                        await interaction.user.send(summaryMsg);
                    } catch (dmError) {}
                }
                
                // Call undo manager
                await handleUndo(interaction, createdRoles, createdChannels);

            }
        } catch (error) {
            console.error('Execution error:', error);
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({ content: `Modification ke waqt kuch error aaya: ${error.message}`, ephemeral: true });
                } else {
                    await interaction.reply({ content: `Modification ke waqt kuch error aaya: ${error.message}`, ephemeral: true });
                }
            } catch (replyError) {}
        }
    }
};
