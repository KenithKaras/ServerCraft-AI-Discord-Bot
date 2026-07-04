const { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { supabase } = require('../supabase');
const { handleUndo } = require('../undoManager.js');

// Temporary store for pending restores
const pendingRestores = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restore')
        .setDescription('Restore the server structure from a saved backup')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Fetch backups from Supabase
            const { data: backups, error } = await supabase
                .from('server_backups')
                .select('*')
                .eq('guild_id', interaction.guild.id)
                .order('created_at', { ascending: false })
                .limit(25);

            if (error) throw error;

            if (!backups || backups.length === 0) {
                return interaction.editReply({ content: 'Is server ke liye koi backups available nahi hain.' });
            }

            const options = backups.map(doc => {
                const date = new Date(doc.created_at);
                return {
                    label: date.toLocaleString(),
                    description: `Backup ID: ${doc.id}`,
                    value: doc.id
                };
            });

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('restore_select')
                        .setPlaceholder('Ek backup select karein...')
                        .addOptions(options)
                );

            await interaction.editReply({ content: 'Niche list mein se wo backup chunein jise aap restore karna chahte hain:', components: [row] });

        } catch (error) {
            console.error('Restore Init Error:', error);
            await interaction.editReply({ content: `Error: ${error.message}` });
        }
    },

    async handleSelect(interaction) {
        if (interaction.customId !== 'restore_select') return;
        
        try {
            const selectedBackupId = interaction.values[0];
            
            const { data, error } = await supabase
                .from('server_backups')
                .select('backup_data')
                .eq('id', selectedBackupId)
                .single();
            
            if (error || !data) {
                return interaction.update({ content: 'Ye backup ab available nahi hai.', components: [] });
            }

            const backupData = data.backup_data;
            pendingRestores.set(interaction.user.id, backupData);

            const guild = interaction.guild;
            
            // Calculate what will be deleted
            const currentRoles = guild.roles.cache.filter(r => !r.managed && r.id !== guild.id);
            const currentChannels = guild.channels.cache;
            
            const rolesToDeleteCount = currentRoles.size;
            const channelsToDeleteCount = currentChannels.size;
            
            // Calculate what will be created
            const rolesToCreateCount = backupData.roles ? backupData.roles.length : 0;
            let channelsToCreateCount = 0;
            if (backupData.categories) {
                backupData.categories.forEach(cat => {
                    if (cat.name !== 'Uncategorized') channelsToCreateCount++;
                    if (cat.channels) channelsToCreateCount += cat.channels.length;
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('Restore Preview & Safety Check')
                .setDescription(`⚠️ **WARNING:** Ye action aapke server ko puri tarah overwrite kar dega.\n\n**Action Summary:**\n🔴 **${rolesToDeleteCount} Roles** aur **${channelsToDeleteCount} Channels** delete honge.\n🟢 **${rolesToCreateCount} Roles** aur **${channelsToCreateCount} Channels** backup se recreate honge.\n\n*Note: Naye items pehle create honge, uske baad hi purane items delete kiye jayenge.*`)
                .setColor('#ff9900');

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('restore_confirm')
                        .setLabel('Confirm Restore')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('restore_cancel')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary),
                );

            await interaction.update({ content: '', embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Restore Select Error:', error);
            await interaction.update({ content: `Error: ${error.message}`, components: [] });
        }
    },

    async handleButton(interaction) {
        if (!interaction.customId.startsWith('restore_')) return;
        
        try {
            const action = interaction.customId.split('_')[1];
            
            if (action === 'cancel') {
                pendingRestores.delete(interaction.user.id);
                await interaction.update({ content: 'Restore cancel ho gaya.', embeds: [], components: [] });
                return;
            }

            if (action === 'confirm') {
                const structure = pendingRestores.get(interaction.user.id);
                if (!structure) {
                    return interaction.update({ content: 'Session expire ho gaya hai, kripya dobara /restore run karein.', embeds: [], components: [] });
                }

                await interaction.update({ content: 'Restore start ho raha hai... Pehle naye roles aur channels create kiye ja rahe hain.', embeds: [], components: [] });
                
                const guild = interaction.guild;
                const delay = ms => new Promise(res => setTimeout(res, ms));

                // Save IDs of OLD items before we create new ones
                const oldRoleIds = Array.from(guild.roles.cache.filter(r => !r.managed && r.id !== guild.id).keys());
                const oldChannelIds = Array.from(guild.channels.cache.keys());

                const createdRoles = [];
                const createdChannels = [];
                let creationFailed = false;
                
                try {
                    // Re-create from structure FIRST
                    for (const roleData of structure.roles || []) {
                        const permissionsArray = (roleData.permissions || []).map(p => typeof p === 'string' ? PermissionsBitField.Flags[p] : p).filter(Boolean);
                        const newRole = await guild.roles.create({
                            name: roleData.name,
                            color: roleData.color || undefined,
                            permissions: permissionsArray,
                            reason: 'Backup Restore',
                        });
                        createdRoles.push(newRole.id);
                        await delay(300);
                    }

                    for (const catData of structure.categories || []) {
                        let categoryId = null;
                        if (catData.name !== 'Uncategorized') {
                            const category = await guild.channels.create({
                                name: catData.name,
                                type: ChannelType.GuildCategory,
                                reason: 'Backup Restore',
                            });
                            createdChannels.push(category.id);
                            categoryId = category.id;
                            await delay(300);
                        }
                        
                        for (const chData of catData.channels || []) {
                            const cType = chData.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
                            const newChannel = await guild.channels.create({
                                name: chData.name,
                                type: cType,
                                parent: categoryId,
                                reason: 'Backup Restore',
                            });
                            createdChannels.push(newChannel.id);
                            await delay(300);
                        }
                    }
                } catch (err) {
                    console.error(`Creation Phase Failed: ${err.message}`);
                    creationFailed = true;
                    // Note: If creation failed midway, we DO NOT proceed to delete old items.
                    await interaction.followUp({ content: `❌ Restore ruk gaya kyunki create karte waqt error aaya: ${err.message}. Purane channels/roles safe hain!`, ephemeral: true });
                }

                if (!creationFailed) {
                    await interaction.followUp({ content: 'Naye items ban gaye! Ab purane items delete ho rahe hain...', ephemeral: true });
                    
                    // Clean up OLD non-managed roles and channels only
                    for (const roleId of oldRoleIds) {
                        try { 
                            const role = guild.roles.cache.get(roleId);
                            if (role) await role.delete(); 
                            await delay(200); 
                        } catch (e) { /* ignore */ }
                    }

                    for (const channelId of oldChannelIds) {
                        try { 
                            const channel = guild.channels.cache.get(channelId);
                            if (channel) await channel.delete(); 
                            await delay(200); 
                        } catch (e) { /* ignore */ }
                    }

                    pendingRestores.delete(interaction.user.id);
                    
                    try {
                        await interaction.followUp({ content: '✅ Restore complete! Server successfully updated.', ephemeral: true });
                    } catch (finalError) {
                        console.log('Could not send final restore message (channel was likely deleted).');
                        // Try sending a DM instead
                        try {
                            await interaction.user.send('✅ Restore complete! Server successfully updated. (Message sent via DM because the original channel was deleted).');
                        } catch (dmError) {
                            // User has DMs disabled, ignore
                        }
                    }
                    
                    await handleUndo(interaction, createdRoles, createdChannels);
                }
            }
        } catch (error) {
            console.error('Execution error:', error);
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({ content: `Error: ${error.message}`, ephemeral: true });
                } else {
                    await interaction.reply({ content: `Error: ${error.message}`, ephemeral: true });
                }
            } catch (replyError) {
                console.error('Could not send error message:', replyError.message);
            }
        }
    }
};
