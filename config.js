require("dotenv").config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  memberRoleName: process.env.MEMBER_ROLE_NAME || "Member",
  ownerRoleNames: (process.env.OWNER_ROLE_NAMES || "หัวแก๊ง,รองแก๊ง,Co-Leader")
    .split(",").map(s => s.trim()).filter(Boolean),
  timezone: process.env.TIMEZONE || "Asia/Bangkok"
};