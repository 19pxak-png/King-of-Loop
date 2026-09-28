require("dotenv").config();
const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits,
  ChannelType,
  OverwriteType
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const COLORS = {
  leader: 0xF1C40F,
  coleader: 0x9B59B6,
  underboss: 0xE74C3C,
  captain: 0xE67E22,
  senior: 0x3498DB,
  member: 0x2ECC71,
  trial: 0x95A5A6,
  alliance: 0x1ABC9C,
  visitor: 0x7F8C8D,
  staff: 0x5865F2
};

const ROLE_NAMES = [
  ["👑 GANG LEADER", COLORS.leader],
  ["💎 CO-LEADER", COLORS.coleader],
  ["🔥 UNDERBOSS", COLORS.underboss],
  ["⚔️ CAPTAIN", COLORS.captain],
  ["🛡️ SENIOR MEMBER", COLORS.senior],
  ["🔫 MEMBER", COLORS.member],
  ["🌱 TRIAL MEMBER", COLORS.trial],
  ["🤝 ALLIANCE", COLORS.alliance],
  ["👤 VISITOR", COLORS.visitor],
  ["🛡️ STAFF", COLORS.staff]
];

const LEAVE_TYPES = {
  late: "🟢 ลาเข้าเมืองสาย",
  partial: "🟡 ลาบางช่วงเวลา",
  absent: "🔴 ลาไม่เข้าเมือง",
  business: "🔵 ลาธุระ",
  emergency: "⚫ ลาฉุกเฉิน"
};

const LEADER_ROLE_NAMES = new Set([
  "👑 GANG LEADER",
  "💎 CO-LEADER",
  "🔥 UNDERBOSS",
  "⚔️ CAPTAIN",
  "🛡️ SENIOR MEMBER",
  "🛡️ STAFF"
]);

const commandData = [
  new SlashCommandBuilder()
    .setName("setup-server")
    .setDescription("สร้างโครงสร้าง Discord 40 FPS อัตโนมัติ")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),
  new SlashCommandBuilder()
    .setName("setup-leave")
    .setDescription("ติดตั้ง/ส่งแผงระบบลา 40 FPS")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),
  new SlashCommandBuilder()
    .setName("setup-loop")
    .setDescription("ติดตั้งระบบ Kind of Loop และตารางคะแนน")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),
  new SlashCommandBuilder()
    .setName("kind-of-loop")
    .setDescription("ส่งหลักฐาน Kind of Loop และรับ 1 คะแนนต่อคน")
    .addIntegerOption(option => option
      .setName("people")
      .setDescription("จำนวนคนในหลักฐาน (1 คน = 1 คะแนน)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(50))
    .addAttachmentOption(option => option
      .setName("evidence")
      .setDescription("รูปภาพหลักฐาน Kind of Loop")
      .setRequired(true))
    .addStringOption(option => option
      .setName("names")
      .setDescription("ชื่อ IC ของคนที่ร่วม (คั่นด้วย , )")
      .setRequired(false)
      .setMaxLength(1000))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("score")
    .setDescription("ดูคะแนน Kind of Loop ของตัวเอง")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("ดูตารางคะแนน Kind of Loop")
    .toJSON()
];

function safeName(name) {
  return name.toLowerCase();
}

async function findOrCreateRole(guild, name, color) {
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) {
    role = await guild.roles.create({
      name,
      color,
      reason: "40 FPS Gang Bot setup"
    });
  }
  return role;
}

async function findOrCreateCategory(guild, name, overwrites = []) {
  let category = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name === name
  );
  if (!category) {
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites
    });
  } else if (overwrites.length) {
    await category.permissionOverwrites.set(overwrites);
  }
  return category;
}

async function findOrCreateText(guild, name, parent, overwrites = []) {
  let channel = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText &&
      c.name === name &&
      c.parentId === parent.id
  );
  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parent.id,
      permissionOverwrites: overwrites
    });
  } else if (overwrites.length) {
    await channel.permissionOverwrites.set(overwrites);
  }
  return channel;
}

async function findOrCreateVoice(guild, name, parent, overwrites = []) {
  let channel = guild.channels.cache.find(
    c => c.type === ChannelType.GuildVoice &&
      c.name === name &&
      c.parentId === parent.id
  );
  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: parent.id,
      permissionOverwrites: overwrites
    });
  } else if (overwrites.length) {
    await channel.permissionOverwrites.set(overwrites);
  }
  return channel;
}

function allowText(roleId, extra = {}) {
  return {
    id: roleId,
    type: OverwriteType.Role,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.EmbedLinks,
      ...extra.allow || []
    ],
    deny: extra.deny || []
  };
}

function denyView(roleId) {
  return {
    id: roleId,
    type: OverwriteType.Role,
    deny: [PermissionFlagsBits.ViewChannel]
  };
}

function allowView(roleId) {
  return {
    id: roleId,
    type: OverwriteType.Role,
    allow: [PermissionFlagsBits.ViewChannel]
  };
}

const DATA_DIR = path.join(__dirname, "data");
const SCORE_FILE = path.join(DATA_DIR, "kind-of-loop-scores.json");

function ensureScoreStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SCORE_FILE)) fs.writeFileSync(SCORE_FILE, "{}", "utf8");
}

function loadScores() {
  ensureScoreStore();
  try { return JSON.parse(fs.readFileSync(SCORE_FILE, "utf8")); }
  catch { return {}; }
}

function saveScores(scores) {
  ensureScoreStore();
  fs.writeFileSync(SCORE_FILE, JSON.stringify(scores, null, 2), "utf8");
}

function addScore(userId, username, points, names, evidenceUrl, messageUrl) {
  const scores = loadScores();
  const current = scores[userId] || { username, points: 0, submissions: 0, lastSubmission: null };
  current.username = username;
  current.points += points;
  current.submissions += 1;
  current.lastSubmission = new Date().toISOString();
  current.lastEvidenceUrl = evidenceUrl;
  current.lastNames = names || "";
  current.lastMessageUrl = messageUrl || "";
  scores[userId] = current;
  saveScores(scores);
  return current;
}

function getLeaderboard(limit = 10) {
  return Object.entries(loadScores())
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.points - a.points || b.submissions - a.submissions)
    .slice(0, limit);
}

function loopChannels(guild) {
  return {
    evidence: guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === "🏆・หลักฐาน-kind-of-loop"),
    scores: guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === "📊・คะแนน-kind-of-loop")
  };
}

async function setupLoop(guild) {
  const gang = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === "🔥 GANG");
  const parent = gang || null;
  const evidence = await findOrCreateText(guild, "🏆・หลักฐาน-kind-of-loop", parent || await findOrCreateCategory(guild, "🏆 KIND OF LOOP"));
  const scores = await findOrCreateText(guild, "📊・คะแนน-kind-of-loop", parent || await findOrCreateCategory(guild, "🏆 KIND OF LOOP"));

  const recent = await scores.messages.fetch({ limit: 20 }).catch(() => null);
  const already = recent && recent.some(m => m.author.id === client.user.id && m.embeds?.some(e => e.title?.includes("ตารางคะแนน Kind of Loop")));
  if (!already) {
    await scores.send({ embeds: [new EmbedBuilder()
      .setTitle("🏆 ตารางคะแนน Kind of Loop | 40 FPS GANG")
      .setDescription("**กติกา:** 1 คน = 1 คะแนน\n\nส่งหลักฐานด้วยคำสั่ง `/kind-of-loop` โดยแนบรูปภาพและระบุจำนวนคน\n\nดูคะแนนตัวเอง: `/คะแนน`\nดูอันดับ: `/leaderboard`")
      .setFooter({ text: "40 FPS GANG • Kind of Loop Score System" })] });
  }
  return { evidence, scores };
}

async function getSetup(guild) {
  const roles = {};
  for (const [name] of ROLE_NAMES) {
    roles[name] = await findOrCreateRole(guild, name, COLORS[name] || undefined);
  }

  const everyone = guild.roles.everyone;
  const memberRole = roles["🔫 MEMBER"];
  const trialRole = roles["🌱 TRIAL MEMBER"];
  const allianceRole = roles["🤝 ALLIANCE"];
  const visitorRole = roles["👤 VISITOR"];
  const staffRole = roles["🛡️ STAFF"];

  const memberAccess = [
    allowView(memberRole.id),
    allowView(trialRole.id),
    allowView(allianceRole.id)
  ];
  const staffAccess = [allowView(staffRole.id)];

  const info = await findOrCreateCategory(guild, "📌 INFORMATION", [
    allowView(everyone.id)
  ]);
  await findOrCreateText(guild, "📜・กฎแก๊ง", info);
  await findOrCreateText(guild, "📢・ประกาศ", info);
  await findOrCreateText(guild, "🎖️・ยศและหน้าที่", info);
  await findOrCreateText(guild, "📋・รายชื่อสมาชิก", info);

  const recruitment = await findOrCreateCategory(guild, "📝 RECRUITMENT", [
    allowView(everyone.id)
  ]);
  await findOrCreateText(guild, "🎫・สมัครเข้าแก๊ง", recruitment);
  await findOrCreateText(guild, "📋・ผลการสมัคร", recruitment);

  const gang = await findOrCreateCategory(guild, "🔥 GANG", [
    ...memberAccess,
    denyView(visitorRole.id)
  ]);
  await findOrCreateText(guild, "💬・ห้องแก๊ง", gang);
  await findOrCreateText(guild, "📢・คำสั่งแก๊ง", gang);
  await findOrCreateText(guild, "🎯・ภารกิจ", gang);
  await findOrCreateText(guild, "🏆・กิจกรรม", gang);

  const peak = await findOrCreateCategory(guild, "⏰ PEAK TIME", [
    ...memberAccess,
    denyView(visitorRole.id)
  ]);
  const leaveChannel = await findOrCreateText(guild, "📋・ลาไม่เข้าเมือง", peak);
  await findOrCreateText(guild, "📊・สรุปการลา", peak);

  const territory = await findOrCreateCategory(guild, "🗺️ TERRITORY", [
    ...memberAccess,
    denyView(visitorRole.id)
  ]);
  await findOrCreateText(guild, "📍・พื้นที่แก๊ง", territory);
  await findOrCreateText(guild, "⚔️・สงครามแก๊ง", territory);
  await findOrCreateText(guild, "🤝・พันธมิตร", territory);
  await findOrCreateText(guild, "☠️・ศัตรู", territory);

  const staff = await findOrCreateCategory(guild, "🛡️ STAFF", [
    ...staffAccess,
    ...[
      "👑 GANG LEADER",
      "💎 CO-LEADER",
      "🔥 UNDERBOSS",
      "⚔️ CAPTAIN"
    ].map(n => allowView(roles[n].id)),
    denyView(everyone.id)
  ]);
  const review = await findOrCreateText(guild, "🔍・ตรวจสอบการลา", staff);
  await findOrCreateText(guild, "📋・จัดการสมาชิก", staff);
  const log = await findOrCreateText(guild, "📑・LOG", staff);

  const voice = await findOrCreateCategory(guild, "🔊 VOICE", [
    ...memberAccess,
    denyView(visitorRole.id)
  ]);
  const voiceOverwrites = [
    ...memberAccess.map(x => ({
      ...x,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak
      ],
      deny: []
    }))
  ];
  await findOrCreateVoice(guild, "🔊 Lobby", voice, voiceOverwrites);
  await findOrCreateVoice(guild, "🔥 รวมพล", voice, voiceOverwrites);
  await findOrCreateVoice(guild, "🎯 ภารกิจ", voice, voiceOverwrites);
  await findOrCreateVoice(guild, "💤 AFK", voice, voiceOverwrites);

  return { roles, leaveChannel, review, log };
}

async function sendLeavePanel(channel) {
  const recent = await channel.messages.fetch({ limit: 20 });
  const already = recent.some(m =>
    m.author.id === client.user.id &&
    m.components?.some(row =>
      row.components?.some(c => c.customId === "open_leave_type")
    )
  );
  if (already) return;

  const embed = new EmbedBuilder()
    .setTitle("📋 ระบบลาไม่เข้าเมือง | 40 FPS GANG")
    .setDescription(
      "⏰ **PEAK TIME : 19:00–00:00 น.**\n\n" +
      "หากไม่สามารถเข้าเมืองได้ตามปกติ กรุณาแจ้งลาผ่านระบบด้านล่าง\n\n" +
      "เลือกประเภทการลา แล้วกรอกข้อมูลให้ครบถ้วน\n\n" +
      "🟢 ลาเข้าเมืองสาย\n" +
      "🟡 ลาบางช่วงเวลา\n" +
      "🔴 ลาไม่เข้าเมือง\n" +
      "🔵 ลาธุระ\n" +
      "⚫ ลาฉุกเฉิน\n\n" +
      "⚠️ หากเป็นเหตุฉุกเฉิน ให้แจ้งโดยเร็วที่สุด"
    )
    .setFooter({ text: "40 FPS GANG • Leave System" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_leave_type")
      .setLabel("📝 แจ้งลาเข้าเมือง")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

async function setupLeave(guild) {
  const setup = await getSetup(guild);
  await sendLeavePanel(setup.leaveChannel);
  return setup;
}

function hasStaffAccess(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some(role => LEADER_ROLE_NAMES.has(role.name));
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  const guildId = process.env.GUILD_ID;

  if (guildId) {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, guildId),
      { body: commandData }
    );
    console.log("Guild slash commands registered.");
  } else {
    console.log("GUILD_ID not set. Commands were not registered.");
  }
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup-server") {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: "❌ ต้องเป็น Administrator เท่านั้น", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        const setup = await setupLeave(interaction.guild);
        const loop = await setupLoop(interaction.guild);

        await interaction.editReply(
          "✅ **ติดตั้ง 40 FPS Server สำเร็จ**\n\n" +
          `📋 ระบบลา: <#${setup.leaveChannel.id}>\n` +
          `🔍 ตรวจสอบใบลา: <#${setup.review.id}>\n` +
          `📑 LOG: <#${setup.log.id}>\n` +
          `🏆 หลักฐาน Kind of Loop: <#${loop.evidence.id}>\n` +
          `📊 ตารางคะแนน: <#${loop.scores.id}>\n\n` +
          "ถ้าบอทสร้างยศแล้ว ให้ลากยศของ Bot ให้อยู่เหนือยศแก๊งใน Server Settings → Roles"
        );
        return;
      }

      if (interaction.commandName === "setup-loop") {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: "❌ ต้องเป็น Administrator เท่านั้น", ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        const loop = await setupLoop(interaction.guild);
        await interaction.editReply(`✅ ติดตั้งระบบ Kind of Loop แล้ว\n🏆 หลักฐาน: <#${loop.evidence.id}>\n📊 ตารางคะแนน: <#${loop.scores.id}>`);
        return;
      }

      if (interaction.commandName === "setup-leave") {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: "❌ ต้องเป็น Administrator เท่านั้น", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        const setup = await setupLeave(interaction.guild);
        await interaction.editReply(`✅ ติดตั้งระบบลาแล้วที่ <#${setup.leaveChannel.id}>`);
        return;
      }
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "kind-of-loop") {
      const people = interaction.options.getInteger("people", true);
      const evidence = interaction.options.getAttachment("evidence", true);
      const names = interaction.options.getString("names") || "";

      if (!evidence.contentType?.startsWith("image/")) {
        return interaction.reply({ content: "❌ กรุณาแนบไฟล์รูปภาพเท่านั้น", ephemeral: true });
      }

      const { evidence: evidenceChannel, scores: scoresChannel } = await setupLoop(interaction.guild);
      const entry = addScore(interaction.user.id, interaction.user.tag, people, names, evidence.url, null);
      const rank = getLeaderboard(100).findIndex(x => x.userId === interaction.user.id) + 1;

      const embed = new EmbedBuilder()
        .setTitle("🎯 Kind of Loop • หลักฐานใหม่")
        .setDescription(`👤 ผู้ส่ง: ${interaction.user}\n👥 จำนวนคน: **${people} คน**\n⭐ ได้รับคะแนน: **+${people} คะแนน**\n🏆 คะแนนสะสม: **${entry.points} คะแนน**`)
        .addFields(
          { name: "👥 รายชื่อ IC", value: names || "ไม่ได้ระบุ", inline: false },
          { name: "📸 หลักฐาน", value: `[เปิดรูปหลักฐาน](${evidence.url})`, inline: false },
          { name: "🏅 อันดับปัจจุบัน", value: rank > 0 ? `#${rank}` : "-", inline: true }
        )
        .setImage(evidence.url)
        .setFooter({ text: "40 FPS GANG • Kind of Loop • 1 คน = 1 คะแนน" })
        .setTimestamp();

      const msg = await evidenceChannel.send({ content: `${interaction.user} ส่งหลักฐาน Kind of Loop`, embeds: [embed] });
      entry.lastMessageUrl = msg.url;
      const scores = loadScores();
      scores[interaction.user.id] = entry;
      saveScores(scores);

      await scoresChannel.send(`⭐ <@${interaction.user.id}> ได้ **+${people} คะแนน** | คะแนนสะสม **${entry.points}** | หลักฐาน: ${msg.url}`);

      await interaction.reply({
        content: `✅ ส่งหลักฐานสำเร็จ!\n👥 ${people} คน = ⭐ +${people} คะแนน\n🏆 คะแนนสะสมของคุณ: **${entry.points} คะแนน**\n🏅 อันดับ: **#${rank}**`,
        ephemeral: true
      });
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "score") {
      const data = loadScores()[interaction.user.id];
      const rank = getLeaderboard(100).findIndex(x => x.userId === interaction.user.id) + 1;
      return interaction.reply({
        content: data ? `🏆 **Kind of Loop ของคุณ**\n⭐ คะแนน: **${data.points}**\n📸 จำนวนหลักฐาน: **${data.submissions} ครั้ง**\n🏅 อันดับ: **#${rank}**` : "📭 ยังไม่มีคะแนน Kind of Loop ของคุณ",
        ephemeral: true
      });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "leaderboard") {
      const board = getLeaderboard(10);
      const lines = board.length ? board.map((x, i) => `**${i + 1}.** <@${x.userId}> — ⭐ **${x.points} คะแนน** (${x.submissions} หลักฐาน)`) : ["ยังไม่มีข้อมูลคะแนน"];
      const embed = new EmbedBuilder()
        .setTitle("🏆 ตารางคะแนน Kind of Loop | 40 FPS GANG")
        .setDescription(lines.join("\n"))
        .setFooter({ text: "1 คน = 1 คะแนน • แสดง 10 อันดับแรก" })
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.isButton() && interaction.customId === "open_leave_type") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("leave_type_select")
        .setPlaceholder("เลือกประเภทการลา")
        .addOptions(
          Object.entries(LEAVE_TYPES).map(([value, label]) =>
            new StringSelectMenuOptionBuilder().setLabel(label.replace(/^.\s/, "")).setValue(value)
          )
        );

      await interaction.reply({
        content: "📌 **เลือกประเภทการลาก่อนกรอกแบบฟอร์ม**",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "leave_type_select") {
      const type = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`leave_modal_${type}`)
        .setTitle(`40 FPS • ${LEAVE_TYPES[type].replace(/^.\s/, "")}`);

      const icName = new TextInputBuilder()
        .setCustomId("ic_name")
        .setLabel("ชื่อตัวละคร (IC)")
        .setPlaceholder("เช่น John Wick")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

      const date = new TextInputBuilder()
        .setCustomId("date")
        .setLabel("วันที่ลา")
        .setPlaceholder("เช่น 28/09/2026")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);

      const arrival = new TextInputBuilder()
        .setCustomId("arrival")
        .setLabel("เวลาเข้าเมืองโดยประมาณ")
        .setPlaceholder("เช่น 21:00 / หลัง 22:00 / ไม่แน่นอน")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(40);

      const reason = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("เหตุผล")
        .setPlaceholder("เช่น ติดธุระ / ทำงาน / ไม่สะดวกเข้าเมือง")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(300);

      modal.addComponents(
        new ActionRowBuilder().addComponents(icName),
        new ActionRowBuilder().addComponents(date),
        new ActionRowBuilder().addComponents(arrival),
        new ActionRowBuilder().addComponents(reason)
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("leave_modal_")) {
      const type = interaction.customId.replace("leave_modal_", "");
      const leaveType = LEAVE_TYPES[type] || "ไม่ระบุ";

      const icName = interaction.fields.getTextInputValue("ic_name");
      const date = interaction.fields.getTextInputValue("date");
      const arrival = interaction.fields.getTextInputValue("arrival");
      const reason = interaction.fields.getTextInputValue("reason");

      const review = interaction.guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && c.name === "🔍・ตรวจสอบการลา"
      );

      if (!review) {
        return interaction.reply({
          content: "❌ ยังไม่ได้ติดตั้งระบบเซิร์ฟเวอร์ ให้ Staff ใช้ /setup-server ก่อน",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📝 ใบลาใหม่ | 40 FPS GANG")
        .setDescription("**สถานะ:** 🟡 รอตรวจสอบ")
        .addFields(
          { name: "👤 ชื่อตัวละคร (IC)", value: icName, inline: true },
          { name: "📌 ประเภทการลา", value: leaveType, inline: true },
          { name: "📅 วันที่ลา", value: date, inline: true },
          { name: "⏰ เวลาเข้าเมืองโดยประมาณ", value: arrival, inline: true },
          { name: "📝 เหตุผล", value: reason, inline: false },
          { name: "💬 Discord ติดต่อกลับ", value: `<@${interaction.user.id}>`, inline: false },
          { name: "👤 ผู้แจ้ง", value: `${interaction.user}`, inline: false }
        )
        .setFooter({ text: "40 FPS GANG • Leave System" })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_leave_${interaction.user.id}`)
          .setLabel("🟢 อนุมัติ")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_leave_${interaction.user.id}`)
          .setLabel("🔴 ไม่อนุมัติ")
          .setStyle(ButtonStyle.Danger)
      );

      await review.send({ embeds: [embed], components: [row] });

      await interaction.reply({
        content: "✅ ส่งใบลาเรียบร้อยแล้ว\nรอหัวหน้า/Staff ตรวจสอบในห้องตรวจสอบการลา",
        ephemeral: true
      });
      return;
    }

    if (
      interaction.isButton() &&
      (interaction.customId.startsWith("approve_leave_") ||
       interaction.customId.startsWith("reject_leave_"))
    ) {
      if (!hasStaffAccess(interaction.member)) {
        return interaction.reply({
          content: "❌ คุณไม่มีสิทธิ์ตรวจสอบใบลา",
          ephemeral: true
        });
      }

      const approved = interaction.customId.startsWith("approve_leave_");
      const targetId = interaction.customId.split("_").pop();

      const oldEmbed = interaction.message.embeds[0];
      const embed = EmbedBuilder.from(oldEmbed)
        .setDescription(`**สถานะ:** ${approved ? "🟢 อนุมัติแล้ว" : "🔴 ไม่อนุมัติ"}`)
        .addFields({
          name: "👑 ผู้ตรวจสอบ",
          value: `${interaction.user}`,
          inline: false
        });

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("leave_done")
          .setLabel(approved ? "🟢 อนุมัติแล้ว" : "🔴 ไม่อนุมัติ")
          .setStyle(approved ? ButtonStyle.Success : ButtonStyle.Danger)
          .setDisabled(true)
      );

      await interaction.update({ embeds: [embed], components: [disabledRow] });

      const logChannel = interaction.guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && c.name === "📑・LOG"
      );

      if (logChannel) {
        await logChannel.send(
          `${approved ? "🟢" : "🔴"} ใบลา${approved ? "อนุมัติ" : "ไม่อนุมัติ"} | ผู้ตรวจสอบ: ${interaction.user} | ผู้แจ้ง: <@${targetId}>`
        );
      }

      try {
        const user = await client.users.fetch(targetId);
        await user.send(
          `📋 **ผลการแจ้งลา 40 FPS GANG**\n\n` +
          `${approved ? "🟢 ใบลาของคุณได้รับการอนุมัติแล้ว" : "🔴 ใบลาของคุณไม่ได้รับการอนุมัติ"}\n` +
          `ตรวจสอบโดย: ${interaction.user}`
        );
      } catch (_) {}
    }
  } catch (err) {
    console.error(err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ เกิดข้อผิดพลาด กรุณาติดต่อ Staff",
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
