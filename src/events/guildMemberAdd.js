// Frisch beigetretene Member bekommen automatisch die Rolle aus AUTO_ROLE_ID
const { Events } = require("discord.js");

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const roleId = process.env.AUTO_ROLE_ID;
    if (!roleId) return;

    try {
      await member.roles.add(roleId, "Automatische Rolle beim Beitreten");
    } catch (error) {
      console.error(`Auto-Rolle fehlgeschlagen (${member.user.tag}): ${error.message}`);
    }
  },
};
