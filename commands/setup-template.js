const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType } = require('discord.js');
const { handleUndo } = require('../undoManager.js');

const templates = {
    'rp-server': {
        roles: [
            { name: 'Admin', color: '#FF0000', permissions: ['Administrator'] },
            { name: 'Moderator', color: '#FFA500', permissions: ['ManageMessages', 'KickMembers'] },
            { name: 'VIP', color: '#FFD700', permissions: [] },
            { name: 'Player', color: '#00FF00', permissions: [] }
        ],
        categories: [
            {
                name: 'Information',
                channels: [ { name: 'rules', type: 'text' }, { name: 'announcements', type: 'text' } ]
            },
            {
                name: 'Roleplay Zone',
                channels: [ { name: 'general-rp', type: 'text' }, { name: 'city-square', type: 'text' }, { name: 'OOC-Chat', type: 'text' } ]
            },
            {
                name: 'Voice Channels',
                channels: [ { name: 'General Voice', type: 'voice' }, { name: 'RP Voice 1', type: 'voice' } ]
            }
        ]
    },
    'gaming-clan': {
        roles: [
            { name: 'Clan Leader', color: '#ff0000', permissions: ['Administrator'] },
            { name: 'Officer', color: '#0000ff', permissions: ['ManageMessages'] },
            { name: 'Member', color: '#00ff00', permissions: [] }
        ],
        categories: [
            {
                name: 'General',
                channels: [ { name: 'chat', type: 'text' }, { name: 'memes', type: 'text' } ]
            },
            {
                name: 'Gaming',
                channels: [ { name: 'looking-for-group', type: 'text' }, { name: 'Squad 1', type: 'voice' }, { name: 'Squad 2', type: 'voice' } ]
            }
        ]
    },
    'study-group': {
        roles: [
            { name: 'Teacher', color: '#ff00ff', permissions: ['ManageMessages'] },
            { name: 'Student', color: '#00ffff', permissions: [] }
        ],
        categories: [
            {
                name: 'Resources',
                channels: [ { name: 'announcements', type: 'text' }, { name: 'materials', type: 'text' } ]
            },
            {
                name: 'Study Rooms',
                channels: [ { name: 'general-discussion', type: 'text' }, { name: 'Quiet Room', type: 'voice' }, { name: 'Group Study', type: 'voice' } ]
            }
        ]
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-template')
        .setDescription('Pre-built template se server setup karein'),
    
    async execute(interaction) {
        const select = new StringSelectMenuBuilder()
            .setCustomId('template_select')
            .setPlaceholder('Template select karein')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('RP Server').setValue('rp-server').setDescription('Roleplay server with Admin, Mod, VIP roles'),
                new StringSelectMenuOptionBuilder().setLabel('Gaming Clan').setValue('gaming-clan').setDescription('For esports and gaming communities'),
                new StringSelectMenuOptionBuilder().setLabel('Study Group').setValue('study-group').setDescription('For students and educational groups'),
            );

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.reply({
            content: 'Konsa server template use karna chahte hain?',
            components: [row],
            ephemeral: true
        });
    },

    async handleSelect(interaction) {
        if (interaction.customId !== 'template_select') return;

        const templateId = interaction.values[0];
        const structure = templates[templateId];

        if (!structure) {
            return interaction.update({ content: 'Invalid template select hua.', components: [] });
        }

        await interaction.update({ content: `${templateId} template se setup start ho raha hai...`, components: [] });

        const guild = interaction.guild;
        
        try {
            const createdRoles = [];
            const createdChannels = [];
            const failedItems = [];
            
            const delay = ms => new Promise(res => setTimeout(res, ms));

            // Create Roles
            for (const roleData of structure.roles || []) {
                console.log(`[Template] Creating role: ${roleData.name}...`);
                try {
                    const newRole = await guild.roles.create({
                        name: roleData.name,
                        color: roleData.color || undefined,
                        reason: 'Template Server Setup',
                    });
                    createdRoles.push(newRole.id);
                    console.log(`[Template] Creating role: ${roleData.name}... Success`);
                    await interaction.followUp({ content: `Role \`${roleData.name}\` ban gaya!`, ephemeral: true });
                } catch (err) {
                    console.log(`[Template] Creating role: ${roleData.name}... Failed: ${err.message}`);
                    failedItems.push(`Role: ${roleData.name}`);
                }
                await delay(400); // 400ms delay to avoid rate limits
            }

            // Create Categories and Channels
            for (const catData of structure.categories || []) {
                console.log(`[Template] Creating category: ${catData.name}...`);
                let categoryId = null;
                try {
                    const category = await guild.channels.create({
                        name: catData.name,
                        type: ChannelType.GuildCategory,
                        reason: 'Template Server Setup',
                    });
                    createdChannels.push(category.id);
                    categoryId = category.id;
                    console.log(`[Template] Creating category: ${catData.name}... Success`);
                } catch (err) {
                    console.log(`[Template] Creating category: ${catData.name}... Failed: ${err.message}`);
                    failedItems.push(`Category: ${catData.name}`);
                }
                await delay(400);
                
                for (const chData of catData.channels || []) {
                    console.log(`[Template] Creating channel: ${chData.name}...`);
                    try {
                        const cType = chData.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
                        const newChannel = await guild.channels.create({
                            name: chData.name,
                            type: cType,
                            parent: categoryId, // Will be null if category failed, creating it at root
                            reason: 'Template Server Setup',
                        });
                        createdChannels.push(newChannel.id);
                        console.log(`[Template] Creating channel: ${chData.name}... Success`);
                    } catch (err) {
                        console.log(`[Template] Creating channel: ${chData.name}... Failed: ${err.message}`);
                        failedItems.push(`Channel: ${chData.name}`);
                    }
                    await delay(400);
                }
            }

            const totalCreated = createdRoles.length + createdChannels.length;
            let summaryMsg = `✅ Template setup complete! ${totalCreated} items (roles/channels) create hue.`;
            if (failedItems.length > 0) {
                summaryMsg += `\n⚠️ ${failedItems.length} items fail hue:\n- ${failedItems.join('\n- ')}`;
            }
            
            await interaction.followUp({ content: summaryMsg, ephemeral: true });
            
            // Call undo manager
            await handleUndo(interaction, createdRoles, createdChannels);

        } catch (error) {
            console.error('Execution error:', error);
            await interaction.followUp({ content: 'Setup ke waqt error aaya.', ephemeral: true });
        }
    }
};
