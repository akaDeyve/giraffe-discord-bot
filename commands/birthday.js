const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { setBirthday, deleteBirthday, getBirthday } = require("../src/birthdays");

function isValidDate(day, month, year) {
  const probe = new Date(year, month - 1, day);
  return probe.getDate() === day && probe.getMonth() === month - 1;
}

function currentAge(birthday) {
  if (!birthday.year) return null;
  const now = new Date();
  const birthdayThisYear = new Date(now.getFullYear(), birthday.month - 1, birthday.day);
  const years = now.getFullYear() - birthday.year;
  return now >= birthdayThisYear ? years : years - 1;
}

const setSubcommand = (sub) =>
  sub
    .setName("set")
    .setDescription("Deinen Geburtstag eintragen")
    .addIntegerOption((option) =>
      option.setName("tag").setDescription("Tag des Monats (1-31)").setRequired(true).setMinValue(1).setMaxValue(31),
    )
    .addIntegerOption((option) =>
      option.setName("monat").setDescription("Monat (1-12)").setRequired(true).setMinValue(1).setMaxValue(12),
    )
    .addIntegerOption((option) =>
      option
        .setName("jahr")
        .setDescription("Geburtsjahr (optional, für Altersanzeige)")
        .setRequired(false)
        .setMinValue(1900)
        .setMaxValue(new Date().getFullYear()),
    );

const showSubcommand = (sub) =>
  sub
    .setName("show")
    .setDescription("Geburtstag anzeigen")
    .addUserOption((option) =>
      option.setName("user").setDescription("User, dessen Geburtstag angezeigt werden soll (leer = du)"),
    );

module.exports = {
  data: new SlashCommandBuilder()
    .setName("birthday")
    .setDescription("Geburtstage eintragen, löschen und anzeigen")
    .addSubcommand(setSubcommand)
    .addSubcommand((sub) => sub.setName("delete").setDescription("Deinen Geburtstag löschen"))
    .addSubcommand(showSubcommand),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "Dieser Befehl kann nur auf einem Server verwendet werden.",
        flags: MessageFlags.Ephemeral,
      });
    }

    switch (interaction.options.getSubcommand()) {
      case "set": {
        const day = interaction.options.getInteger("tag");
        const month = interaction.options.getInteger("monat");
        const year = interaction.options.getInteger("jahr") ?? null;

        if (!isValidDate(day, month, year ?? 2024)) {
          return interaction.reply({
            content: `Der ${day}.${month}${year ? `.${year}` : ""} existiert nicht.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        await setBirthday(interaction.guildId, interaction.user.id, day, month, year);
        return interaction.reply({
          content: `Dein Geburtstag wurde auf den ${day}.${month}${year ? `.${year}` : ""} gesetzt. Am Tag selbst bekommst du automatisch die Geburtstags-Rolle und eine Nachricht vom Bot.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      case "delete": {
        const deleted = await deleteBirthday(interaction.guildId, interaction.user.id);
        return interaction.reply({
          content: deleted ? "Dein Geburtstag wurde gelöscht." : "Du hast keinen Geburtstag eingetragen.",
          flags: MessageFlags.Ephemeral,
        });
      }

      case "show": {
        const user = interaction.options.getUser("user") ?? interaction.user;
        const birthday = await getBirthday(interaction.guildId, user.id);

        if (!birthday) {
          return interaction.reply({
            content: `${user} hat keinen Geburtstag eingetragen.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const dateText = `${birthday.day}.${birthday.month}${birthday.year ? `.${birthday.year}` : ""}`;
        const age = currentAge(birthday);
        return interaction.reply(
          `${user} hat am ${dateText} Geburtstag${age !== null ? ` und ist heute ${age} Jahre alt` : ""}.`,
        );
      }
    }
  },
};
