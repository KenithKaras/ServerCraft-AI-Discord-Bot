const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

// Map object to store created IDs by guild ID
// Format: guildId => { roles: [roleIds...], channels: [channelIds...] }
const undoStore = new Map();

async function handleUndo(interaction, createdRoles, createdChannels) {
    const guildId = interaction.guild.id;
    
    // Store in memory
    undoStore.set(guildId, { roles: createdRoles, channels: createdChannels });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('undo_setup')
                .setLabel('Undo Last Setup')
                .setStyle(ButtonStyle.Danger)
        );

    // Send the final confirmation message with the Undo button
    const message = await interaction.followUp({
        content: '✅ Setup complete ho gaya! Aap is setup ko agle 5 minute tak undo kar sakte hain.',
        components: [row],
        ephemeral: false
    });

    // Create a 5-minute collector for the button
    const collector = message.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 5 * 60 * 1000 
    });

    collector.on('collect', async i => {
        if (i.customId === 'undo_setup') {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Sirf jisne setup kiya tha, wahi undo kar sakta hai.', ephemeral: true });
            }

            await i.deferReply({ ephemeral: true });
            
            const data = undoStore.get(guildId);
            if (!data) {
                return i.editReply('Undo data nahi mila. Shayad 5 minute ki time limit expire ho gayi hai.');
            }

            let rolesDeleted = 0;
            let channelsDeleted = 0;

            // Delete Channels first
            for (const chId of data.channels) {
                try {
                    const channel = await i.guild.channels.fetch(chId).catch(() => null);
                    if (channel) {
                        await channel.delete('Undo Setup');
                        channelsDeleted++;
                    }
                } catch (err) { console.error('Failed to delete channel', chId); }
            }

            // Delete Roles
            for (const rId of data.roles) {
                try {
                    const role = await i.guild.roles.fetch(rId).catch(() => null);
                    if (role) {
                        await role.delete('Undo Setup');
                        rolesDeleted++;
                    }
                } catch (err) { console.error('Failed to delete role', rId); }
            }

            // Remove from memory
            undoStore.delete(guildId);
            
            // Disable the button in the original message
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('undo_setup')
                        .setLabel('Undo Last Setup')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true)
                );
            await message.edit({ components: [disabledRow] }).catch(() => {});

            await i.editReply(`Setup undo ho gaya, ${rolesDeleted} roles aur ${channelsDeleted} channels delete kiye.`);
            collector.stop('undone');
        }
    });

    // Cleanup when collector ends (due to time limit or after undo)
    collector.on('end', (collected, reason) => {
        if (reason !== 'undone') {
            undoStore.delete(guildId);
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('undo_setup')
                        .setLabel('Undo Expired')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            message.edit({ components: [disabledRow] }).catch(() => {});
        }
    });
}

module.exports = { handleUndo };
