const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
    {
        name: 'setup',
        description: 'AI se naya Discord server setup karein',
        options: [
            {
                name: 'instructions',
                type: 3, // STRING type
                description: 'Server kaisa chahiye? (e.g. RP server with Admin and VIP roles)',
                required: true,
            }
        ]
    },
    {
        name: 'setup-template',
        description: 'Pre-built template se server setup karein',
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        if (!process.env.CLIENT_ID) {
            console.error('Error: CLIENT_ID is missing in .env file.');
            return;
        }

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
