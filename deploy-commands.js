const { REST, Routes } = require("discord.js");
require("dotenv").config();
const { loadFolder } = require("./src/loaders");

const commands = [...loadFolder("commands").values()].map((command) => command.data.toJSON());
const rest = new REST().setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // Client-ID dynamisch ermitteln und alle globalen Commands ersetzen
    const clientId = (await rest.get(Routes.user())).id;
    const data = await rest.put(Routes.applicationCommands(clientId), { body: commands });

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
