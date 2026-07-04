const { Client, GatewayIntentBits, Collection, Events, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
    // Check if the bot has required permissions before processing any interaction
    if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator) &&
        (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
         !interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels))) {
        const errorMsg = 'Mujhe server setup karne ke liye `Administrator` ya `Manage Roles` aur `Manage Channels` permissions chahiye. Kripya permissions theek karein.';
        if (interaction.isRepliable()) {
            return interaction.reply({ content: errorMsg, ephemeral: true });
        }
        return;
    }

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: 'Command run karte waqt error aaya!', embeds: [], components: [] });
            } else {
                await interaction.reply({ content: 'Command run karte waqt error aaya!', ephemeral: true });
            }
        }
    } else if (interaction.isButton()) {
        // Handle confirm/cancel buttons
        try {
            for (const command of client.commands.values()) {
                if (command.handleButton && typeof command.handleButton === 'function') {
                    await command.handleButton(interaction);
                }
            }
        } catch (error) {
            console.error(error);
        }
    } else if (interaction.isStringSelectMenu()) {
        try {
            for (const command of client.commands.values()) {
                if (command.handleSelect && typeof command.handleSelect === 'function') {
                    await command.handleSelect(interaction);
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
