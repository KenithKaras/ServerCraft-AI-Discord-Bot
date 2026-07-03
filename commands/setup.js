const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const { generateServerStructure } = require('../ai.js');
const { handleUndo } = require('../undoManager.js');

// Temporary store for generated structures pending confirmation
const pendingSetups = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('AI se naya Discord server setup karein')
        .addStringOption(option =>
            option.setName('instructions')
                .setDescription('Server kaisa chahiye? (e.g. RP server with Admin and VIP roles)')
                .setRequired(true)),
    
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            const instructions = interaction.options.getString('instructions');
            
            const serverStructure = await generateServerStructure(instructions);
            
            // Validate the structure safely
            if (!serverStructure.roles || !serverStructure.categories) {
                throw new Error("AI ne valid structure return nahi kiya.");
            }

            pendingSetups.set(interaction.user.id, serverStructure);

            let rolesText = serverStructure.roles.map(r => `- ${r.name} (${r.color || 'Default'})`).join('\n') || 'Koi roles nahi';
            let channelsText = serverStructure.categories.map(cat => {
                let text = `**${cat.name}**\n`;
                if (cat.channels) {
                    text += cat.channels.map(ch => `  ↳ ${ch.name} (${ch.type})`).join('\n');
                }
                return text;
            }).join('\n\n') || 'Koi channels nahi';

            const embed = new EmbedBuilder()
                .setTitle('Server Setup Preview')
                .setDescription('Niche diye gaye roles aur channels banaye jayenge:')
                .addFields(
                    { name: 'Roles', value: rolesText.substring(0, 1024) },
                    { name: 'Categories & Channels', value: channelsText.substring(0, 1024) }
                )
                .setColor('#0099ff');

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('setup_confirm')
                        .setLabel('Confirm')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('setup_cancel')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Danger),
                );

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Setup Error:', error);
            await interaction.editReply({ content: `Setup fail ho gaya: ${error.message}`, embeds: [], components: [] });
        }
    },

    async handleButton(interaction) {
        if (!interaction.customId.startsWith('setup_')) return;
        
        try {
            const action = interaction.customId.split('_')[1];
            
            if (action === 'cancel') {
                pendingSetups.delete(interaction.user.id);
                await interaction.update({ content: 'Setup cancel ho gaya.', embeds: [], components: [] });
                return;
            }

            if (action === 'confirm') {
                const structure = pendingSetups.get(interaction.user.id);
                if (!structure) {
                    return interaction.update({ content: 'Session expire ho gaya hai, kripya dobara /setup run karein.', embeds: [], components: [] });
                }

                await interaction.update({ content: 'Setup start ho raha hai... Kripya wait karein.', embeds: [], components: [] });
                
                const guild = interaction.guild;
                
                const createdRoles = [];
                const createdChannels = [];
                const failedItems = [];
                
                const delay = ms => new Promise(res => setTimeout(res, ms));

                // Create Roles
                for (const roleData of structure.roles || []) {
                    console.log(`Creating role: ${roleData.name}...`);
                    try {
                        const permissionsArray = (roleData.permissions || []).map(p => PermissionsBitField.Flags[p]).filter(Boolean);
                        
                        const newRole = await guild.roles.create({
                            name: roleData.name,
                            color: roleData.color || undefined,
                            permissions: permissionsArray,
                            reason: 'AI Server Setup',
                        });
                        createdRoles.push(newRole.id);
                        console.log(`Creating role: ${roleData.name}... Success`);
                        await interaction.followUp({ content: `Role \`${roleData.name}\` ban gaya!`, ephemeral: true });
                    } catch (err) {
                        console.log(`Creating role: ${roleData.name}... Failed: ${err.message}`);
                        failedItems.push(`Role: ${roleData.name}`);
                    }
                    await delay(400); // 400ms delay to avoid rate limits
                }

                // Create Categories and Channels
                for (const catData of structure.categories || []) {
                    console.log(`Creating category: ${catData.name}...`);
                    let categoryId = null;
                    try {
                        const category = await guild.channels.create({
                            name: catData.name,
                            type: ChannelType.GuildCategory,
                            reason: 'AI Server Setup',
                        });
                        createdChannels.push(category.id);
                        categoryId = category.id;
                        console.log(`Creating category: ${catData.name}... Success`);
                    } catch (err) {
                        console.log(`Creating category: ${catData.name}... Failed: ${err.message}`);
                        failedItems.push(`Category: ${catData.name}`);
                    }
                    await delay(400);
                    
                    for (const chData of catData.channels || []) {
                        console.log(`Creating channel: ${chData.name}...`);
                        try {
                            const cType = chData.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
                            const newChannel = await guild.channels.create({
                                name: chData.name,
                                type: cType,
                                parent: categoryId, // Will be null if category failed, creating it at root
                                reason: 'AI Server Setup',
                            });
                            createdChannels.push(newChannel.id);
                            console.log(`Creating channel: ${chData.name}... Success`);
                        } catch (err) {
                            console.log(`Creating channel: ${chData.name}... Failed: ${err.message}`);
                            failedItems.push(`Channel: ${chData.name}`);
                        }
                        await delay(400);
                    }
                }

                pendingSetups.delete(interaction.user.id);
                
                const totalCreated = createdRoles.length + createdChannels.length;
                let summaryMsg = `✅ Setup complete! ${totalCreated} items (roles/channels) create hue.`;
                if (failedItems.length > 0) {
                    summaryMsg += `\n⚠️ ${failedItems.length} items fail hue:\n- ${failedItems.join('\n- ')}`;
                }
                
                // We use handleUndo with the summary message logic directly in it, 
                // but handleUndo already sends its own message. We'll send our summary first.
                await interaction.followUp({ content: summaryMsg, ephemeral: true });
                
                // Call undo manager
                await handleUndo(interaction, createdRoles, createdChannels);

            }
        } catch (error) {
            console.error('Execution error:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `Setup ke waqt kuch error aaya: ${error.message}`, embeds: [], components: [] });
            } else {
                await interaction.reply({ content: `Setup ke waqt kuch error aaya: ${error.message}`, ephemeral: true });
            }
        }
    }
};
