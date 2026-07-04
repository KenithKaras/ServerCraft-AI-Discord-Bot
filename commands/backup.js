const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { supabase } = require('../supabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Create a backup of the current server roles and channels')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            
            // Fetch the latest cache
            await guild.roles.fetch();
            await guild.channels.fetch();

            const backupData = {
                roles: [],
                categories: []
            };

            // Map roles
            // Skip @everyone and managed roles
            const roles = guild.roles.cache.filter(r => !r.managed && r.id !== guild.id).sort((a, b) => b.position - a.position);
            roles.forEach(r => {
                backupData.roles.push({
                    name: r.name,
                    color: r.hexColor,
                    permissions: r.permissions.toArray()
                });
            });

            // Map channels and categories
            const categories = guild.channels.cache.filter(c => c.type === 4); 
            const channels = guild.channels.cache.filter(c => c.type !== 4);

            const uncategorizedChannels = channels.filter(c => !c.parentId).map(c => ({
                name: c.name,
                type: c.type === 2 ? 'voice' : 'text'
            }));

            if (uncategorizedChannels.length > 0) {
                backupData.categories.push({
                    name: 'Uncategorized',
                    channels: uncategorizedChannels
                });
            }

            categories.forEach(cat => {
                const catChannels = channels.filter(c => c.parentId === cat.id).map(c => ({
                    name: c.name,
                    type: c.type === 2 ? 'voice' : 'text'
                }));
                backupData.categories.push({
                    name: cat.name,
                    channels: catChannels
                });
            });

            // Save to Supabase
            const { data, error } = await supabase
                .from('server_backups')
                .insert([
                    { guild_id: guild.id, backup_data: backupData }
                ])
                .select();

            if (error) throw error;

            await interaction.editReply({ content: `✅ Server backup successfully created in Supabase!\nBackup ID: \`${data[0].id}\`` });

        } catch (error) {
            console.error('Backup Error:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `Backup fail ho gaya: ${error.message}` });
            } else {
                await interaction.reply({ content: `Backup fail ho gaya: ${error.message}`, ephemeral: true });
            }
        }
    }
};
