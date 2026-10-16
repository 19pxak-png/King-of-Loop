const fs = require("node:fs");
const path = require("node:path");
const {
  Client, GatewayIntentBits, Partials, REST, Routes,
  SlashCommandBuilder, ChannelType, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require("discord.js");
const cfg = require("./config");

if (!cfg.token || !cfg.clientId || !cfg.guildId) {
  console.error("ตั้งค่า DISCORD_TOKEN, CLIENT_ID และ GUILD_ID ใน .env ก่อน");
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const emptyDb = () => ({ members: [], welfare: {}, peak: {}, leaves: {}, stories: [], bank: { balance: 0, ledger: [] }, loop: {}, settings: {} });
function loadDb() {
  try { return { ...emptyDb(), ...JSON.parse(fs.readFileSync(DB_PATH, "utf8")) }; }
  catch { return emptyDb(); }
}
let db = loadDb();
function saveDb() { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

const categories = [
  { name: "🏠・LOBBY", channels: [
    ["📌・ประกาศแก๊ง", "text"], ["👥・รายชื่อสมาชิก-40-fps", "text"],
    ["🤖・แผงควบคุมบอท", "text"], ["💬・พูดคุยทั่วไป", "text"]
  ]},
  { name: "👤・MEMBER", channels: [
    ["📥・สมัครเข้าแก๊ง", "text"], ["📋・ทะเบียนสมาชิก", "text"], ["📨・แจ้งเข้า-ออกแก๊ง", "text"]
  ]},
  { name: "📖・STORY", channels: [
    ["📋・สำรวจคนเล่นสตอรี่", "text"], ["📅・ตารางนัดสตอรี่", "text"], ["🔔・แจ้งเตือนสตอรี่", "text"]
  ]},
  { name: "🛠️・CRAFT", channels: [
    ["🧰・รายการคราฟต์", "text"], ["📝・ลงทะเบียนคราฟต์", "text"], ["📆・นัดหมายคราฟต์", "text"]
  ]},
  { name: "🎒・WELFARE", channels: [
    ["📦・ทะเบียนสวัสดิการ", "text"], ["📊・สรุปสวัสดิการ", "text"], ["🛡️・จัดการสวัสดิการ", "text"]
  ]},
  { name: "⏰・PEAK-TIME", channels: [
    ["✅・เช็กชื่อพีคไทม์", "text"], ["📝・แจ้งลาพีคไทม์", "text"],
    ["📊・สรุปพีคไทม์", "text"], ["🔔・แจ้งเตือนพีคไทม์", "text"]
  ]},
  { name: "💰・GANG-BANK", channels: [
    ["🏦・บัญชีแก๊ง", "text"], ["📒・รายการรับ-จ่าย", "text"],
    ["💵・ยอดส่งเงินแก๊ง", "text"], ["📊・สรุปการเงิน", "text"]
  ]},
  { name: "🏆・KING-OF-LOOP", channels: [
    ["📊・คะแนน-kind-of-loop", "text"], ["📸・หลักฐาน-kind-of-loop", "text"], ["🔄・รีเซ็ตคะแนน", "text"]
  ]},
  { name: "👑・MANAGEMENT", channels: [
    ["🎛️・แผงจัดการแก๊ง", "text"], ["📜・บันทึกการทำงานบอท", "text"], ["⚙️・ตั้งค่าระบบ", "text"]
  ]}
];

const welfareItems = ["ไม้", "มีด", "รถ", "รถนั่ง 4", "รถ GTB", "โล", "สกินไม้"];
const commands = [
  new SlashCommandBuilder().setName("setup-40fps").setDescription("สร้างหมวดและห้องระบบ 40 FPS"),
  new SlashCommandBuilder().setName("panel-40fps").setDescription("ส่งแผงปุ่มระบบ 40 FPS"),
  new SlashCommandBuilder().setName("รายงานพีคไทม์").setDescription("ดูรายงานเช็กชื่อพีคไทม์วันนี้")
].map(c => c.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

function isManager(member) {
  if (!member) return false;
  return member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.some(r => cfg.ownerRoleNames.includes(r.name));
}
function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: cfg.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function panelEmbed() {
  return new EmbedBuilder().setColor(0x5B45D6).setTitle("💜 40 FPS GANG — CONTROL PANEL")
    .setDescription("เลือกปุ่มด้านล่างเพื่อเปิดใช้งานระบบของแก๊ง\n\n⏰ พีคไทม์ 18:00–00:00\n🎒 สวัสดิการ 7 ประเภท\n💰 บัญชีแก๊งและ 🏆 King of Loop")
    .setFooter({ text: "40 FPS Gang Bot • ข้อมูลบันทึกในระบบของเซิร์ฟเวอร์" });
}
function mainRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("welfare_open").setLabel("🎒 สวัสดิการ").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("peak_checkin").setLabel("✅ เช็กพีคไทม์").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("leave_open").setLabel("📝 แจ้งลา").setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("story_open").setLabel("📖 สร้าง/ร่วมสตอรี่").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("bank_view").setLabel("💰 ดูบัญชีแก๊ง").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("loop_open").setLabel("🏆 King of Loop").setStyle(ButtonStyle.Primary)
    )
  ];
}
async function findTextChannel(guild, channelName) {
  return guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === channelName);
}
async function setupGuild(guild) {
  await guild.channels.fetch();
  for (const category of categories) {
    let parent = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === category.name);
    if (!parent) parent = await guild.channels.create({ name: category.name, type: ChannelType.GuildCategory });
    for (const [name] of category.channels) {
      const exists = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name && c.parentId === parent.id);
      if (!exists) await guild.channels.create({ name, type: ChannelType.GuildText, parent: parent.id });
    }
  }
  const panelChannel = await findTextChannel(guild, "🤖・แผงควบคุมบอท");
  if (panelChannel) await panelChannel.send({ embeds: [panelEmbed()], components: mainRows() });
  const welfareChannel = await findTextChannel(guild, "📦・ทะเบียนสวัสดิการ");
  if (welfareChannel) await welfareChannel.send({ embeds: [new EmbedBuilder().setColor(0x36A269).setTitle("🎒 ทะเบียนสวัสดิการ 40 FPS").setDescription("เลือกประเภทรายการเพื่อดู/ลงทะเบียนครอบครอง")], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("welfare_open").setLabel("เปิดทะเบียนสวัสดิการ").setStyle(ButtonStyle.Success))] });
  const peakChannel = await findTextChannel(guild, "✅・เช็กชื่อพีคไทม์");
  if (peakChannel) await peakChannel.send({ embeds: [new EmbedBuilder().setColor(0xE5A33D).setTitle("⏰ เช็กชื่อพีคไทม์").setDescription("ช่วงเวลา 18:00–00:00 กดปุ่มเมื่อเข้าเวลา")], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("peak_checkin").setLabel("✅ เช็กชื่อวันนี้").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("leave_open").setLabel("📝 แจ้งลา").setStyle(ButtonStyle.Secondary))] });
  const storyChannel = await findTextChannel(guild, "📋・สำรวจคนเล่นสตอรี่");
  if (storyChannel) await storyChannel.send({ embeds: [new EmbedBuilder().setColor(0x7C5CE7).setTitle("📖 สำรวจคนเล่นสตอรี่").setDescription("สร้างแบบสำรวจสตอรี่ หรือกดเข้าร่วมแบบสำรวจล่าสุด")], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("story_open").setLabel("📖 สร้างสตอรี่").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("story_join").setLabel("🙋 เข้าร่วมล่าสุด").setStyle(ButtonStyle.Success))] });
  const bankChannel = await findTextChannel(guild, "🏦・บัญชีแก๊ง");
  if (bankChannel) await bankChannel.send({ embeds: [new EmbedBuilder().setColor(0xD4AC0D).setTitle("💰 บัญชีแก๊ง").setDescription("ดูยอดคงเหลือ หรือเพิ่ม/หักเงิน (หัวหน้าและรองหัวหน้า)")], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("bank_view").setLabel("ดูยอดเงิน").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId("bank_add").setLabel("เพิ่มเงิน").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("bank_subtract").setLabel("หักเงิน").setStyle(ButtonStyle.Danger))] });
  const loopChannel = await findTextChannel(guild, "📊・คะแนน-kind-of-loop");
  if (loopChannel) await loopChannel.send({ embeds: [new EmbedBuilder().setColor(0xC084FC).setTitle("🏆 King of Loop").setDescription("เพิ่มคะแนนให้สมาชิกและดูตารางคะแนน")], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("loop_open").setLabel("เพิ่มคะแนน").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("loop_view").setLabel("ดูคะแนน").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId("loop_reset").setLabel("รีเซ็ตคะแนน").setStyle(ButtonStyle.Danger))] });
}
function welfareSelect() {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("welfare_select").setPlaceholder("เลือกประเภทสวัสดิการ").addOptions(welfareItems.map(x => ({ label: x, value: x }))));
}
function memberSelect(customId, placeholder, guild) {
  const members = guild.members.cache.filter(m => !m.user.bot).first(25);
  const options = members.map(m => ({ label: m.displayName.slice(0, 100), value: m.id }));
  if (!options.length) options.push({ label: "ไม่พบสมาชิก", value: "none" });
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options));
}
function amountModal(customId, title, amountLabel, noteLabel = "หมายเหตุ") {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("amount").setLabel(amountLabel).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(15)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("note").setLabel(noteLabel).setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100))
  );
  return modal;
}
async function sendMemberDMs(guild, text) {
  const role = guild.roles.cache.find(r => r.name === cfg.memberRoleName);
  if (!role) return { ok: 0, failed: 0, reason: `ไม่พบ role ${cfg.memberRoleName}` };
  let ok = 0, failed = 0;
  for (const member of role.members.values()) {
    try { await member.send(text); ok++; } catch { failed++; }
  }
  return { ok, failed };
}

client.once("ready", async () => {
  console.log(`Ready as ${client.user.tag}`);
  try {
    const rest = new REST({ version: "10" }).setToken(cfg.token);
    await rest.put(Routes.applicationGuildCommands(cfg.clientId, cfg.guildId), { body: commands });
    console.log("Guild slash commands registered");
  } catch (e) { console.error("Register commands failed:", e.message); }
});

client.on("guildMemberAdd", async member => {
  try {
    const role = member.guild.roles.cache.find(r => r.name === cfg.memberRoleName);
    if (role) await member.roles.add(role);
    await sendMemberDMs(member.guild, `🎉 สมาชิกใหม่เข้าร่วม 40 FPS: ${member.user.tag}`);
  } catch (e) { console.error("guildMemberAdd:", e.message); }
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup-40fps") {
        if (!isManager(interaction.member)) return interaction.reply({ content: "เฉพาะหัวหน้า/รองหัวหน้าเท่านั้น", ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        await setupGuild(interaction.guild);
        return interaction.editReply("✅ สร้างหมวด/ห้องที่ยังไม่มี และส่งแผงปุ่มพื้นฐานแล้ว");
      }
      if (interaction.commandName === "panel-40fps") {
        if (!isManager(interaction.member)) return interaction.reply({ content: "เฉพาะหัวหน้า/รองหัวหน้าเท่านั้น", ephemeral: true });
        return interaction.reply({ embeds: [panelEmbed()], components: mainRows() });
      }
      if (interaction.commandName === "รายงานพีคไทม์") {
        const day = todayKey(), data = db.peak[day] || {};
        const names = Object.entries(data).map(([id, v]) => `<@${id}> — ${v.time}`).join("\n") || "ยังไม่มีผู้เช็กชื่อ";
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`📊 รายงานพีคไทม์ ${day}`).setDescription(names)] , ephemeral: true });
      }
    }

    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === "welfare_open") return interaction.reply({ content: "เลือกประเภทสวัสดิการ แล้วกดปุ่มลงทะเบียน/ยกเลิก", components: [welfareSelect()], ephemeral: true });
      if (id === "peak_checkin") {
        const day = todayKey();
        db.peak[day] ||= {};
        db.peak[day][interaction.user.id] = { time: new Date().toLocaleTimeString("th-TH", { timeZone: cfg.timezone }) };
        saveDb();
        return interaction.reply({ content: `✅ เช็กชื่อพีคไทม์แล้ว (${day})`, ephemeral: true });
      }
      if (id === "leave_open") {
        const modal = new ModalBuilder().setCustomId("leave_submit").setTitle("แจ้งลาพีคไทม์");
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("เหตุผล/ประเภทการลา").setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("duration").setLabel("เวลาที่คาดว่าจะลา").setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("contact").setLabel("ช่องทางติดต่อเพิ่มเติม (ถ้ามี)").setStyle(TextInputStyle.Short).setRequired(false))
        );
        return interaction.showModal(modal);
      }
      if (id === "story_open") {
        const modal = new ModalBuilder().setCustomId("story_create").setTitle("สร้างแบบสำรวจสตอรี่");
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("when").setLabel("วันและเวลา").setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("playing").setLabel("เล่นกับใคร/รายละเอียด").setStyle(TextInputStyle.Short).setRequired(true))
        );
        return interaction.showModal(modal);
      }
      if (id === "story_join") {
        const story = db.stories.at(-1);
        if (!story) return interaction.reply({ content: "ยังไม่มีแบบสำรวจสตอรี่", ephemeral: true });
        story.participants ||= [];
        if (!story.participants.includes(interaction.user.id)) story.participants.push(interaction.user.id);
        saveDb();
        return interaction.reply({ content: `🙋 ลงชื่อเข้าร่วมสตอรี่ล่าสุดแล้ว\n${story.when} — ${story.playing}`, ephemeral: true });
      }
      if (id === "bank_view") return interaction.reply({ content: `💰 ยอดเงินแก๊ง: ${Number(db.bank.balance).toLocaleString("th-TH")} บาท`, ephemeral: true });
      if (id === "bank_add" || id === "bank_subtract") {
        if (!isManager(interaction.member)) return interaction.reply({ content: "เฉพาะหัวหน้า/รองหัวหน้าเท่านั้น", ephemeral: true });
        return interaction.showModal(amountModal(id === "bank_add" ? "bank_add_submit" : "bank_subtract_submit", id === "bank_add" ? "เพิ่มเงินแก๊ง" : "หักเงินแก๊ง", "จำนวนเงิน"));
      }
      if (id === "loop_open") return interaction.reply({ content: "เลือกสมาชิกเพื่อเพิ่ม 1 คะแนน", components: [memberSelect("loop_member_select", "เลือกสมาชิก", interaction.guild)], ephemeral: true });
      if (id === "loop_view") {
        const lines = Object.entries(db.loop).sort((a,b) => b[1]-a[1]).map(([uid, pts], i) => `${i+1}. <@${uid}> — ${pts} คะแนน`);
        return interaction.reply({ content: lines.join("\n") || "ยังไม่มีคะแนน", ephemeral: true });
      }
      if (id === "loop_reset") {
        if (!isManager(interaction.member)) return interaction.reply({ content: "เฉพาะหัวหน้า/รองหัวหน้าเท่านั้น", ephemeral: true });
        db.loop = {}; saveDb();
        return interaction.reply({ content: "♻️ รีเซ็ตคะแนน King of Loop แล้ว", ephemeral: true });
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "welfare_select") {
        const item = interaction.values[0], list = db.welfare[item] || [];
        const has = list.includes(interaction.user.id);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`welfare_toggle:${encodeURIComponent(item)}`).setLabel(has ? "ยกเลิกการครอบครอง" : "ลงทะเบียนครอบครอง").setStyle(has ? ButtonStyle.Danger : ButtonStyle.Success)
        );
        return interaction.update({ content: `🎒 **${item}**\nจำนวนผู้ลงทะเบียน: ${list.length}\nรายชื่อ: ${list.map(id => `<@${id}>`).join(", ") || "ยังไม่มี"}`, components: [row] });
      }
      if (interaction.customId === "loop_member_select") {
        const uid = interaction.values[0];
        if (uid === "none") return interaction.reply({ content: "ไม่พบสมาชิก", ephemeral: true });
        db.loop[uid] = (db.loop[uid] || 0) + 1; saveDb();
        return interaction.update({ content: `🏆 เพิ่ม 1 คะแนนให้ <@${uid}> แล้ว รวม ${db.loop[uid]} คะแนน`, components: [] });
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith("welfare_toggle:")) {
      const item = decodeURIComponent(interaction.customId.split(":")[1]);
      db.welfare[item] ||= [];
      const list = db.welfare[item], idx = list.indexOf(interaction.user.id);
      if (idx >= 0) list.splice(idx, 1); else list.push(interaction.user.id);
      saveDb();
      return interaction.reply({ content: `${idx >= 0 ? "ยกเลิก" : "ลงทะเบียน"} **${item}** แล้ว\nจำนวนปัจจุบัน: ${list.length}`, ephemeral: true });
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "leave_submit") {
        const entry = { userId: interaction.user.id, reason: interaction.fields.getTextInputValue("reason"), duration: interaction.fields.getTextInputValue("duration"), contact: interaction.fields.getTextInputValue("contact"), status: "รออนุมัติ", at: new Date().toISOString() };
        db.leaves[todayKey()] ||= []; db.leaves[todayKey()].push(entry); saveDb();
        const channel = await findTextChannel(interaction.guild, "📝・แจ้งลาพีคไทม์");
        if (channel) await channel.send({ embeds: [new EmbedBuilder().setColor(0xE5A33D).setTitle("📝 คำขอลาพีคไทม์").setDescription(`ผู้ลา: <@${entry.userId}>\nเหตุผล: ${entry.reason}\nระยะเวลา: ${entry.duration}\nติดต่อ: ${entry.contact || "-"}\nสถานะ: ${entry.status}`)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("leave_approve").setLabel("อนุมัติ").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("leave_reject").setLabel("ไม่อนุมัติ").setStyle(ButtonStyle.Danger))] });
        return interaction.reply({ content: "ส่งคำขอลาแล้ว รอหัวหน้า/รองหัวหน้าอนุมัติ", ephemeral: true });
      }
      if (interaction.customId === "story_create") {
        const story = { id: Date.now(), creator: interaction.user.id, when: interaction.fields.getTextInputValue("when"), playing: interaction.fields.getTextInputValue("playing"), participants: [interaction.user.id] };
        db.stories.push(story); saveDb();
        const channel = await findTextChannel(interaction.guild, "📋・สำรวจคนเล่นสตอรี่");
        if (channel) await channel.send({ embeds: [new EmbedBuilder().setColor(0x7C5CE7).setTitle("📖 สำรวจคนเล่นสตอรี่").setDescription(`ผู้สร้าง: <@${story.creator}>\nวันเวลา: ${story.when}\nเล่นกับใคร/รายละเอียด: ${story.playing}\nผู้เข้าร่วม: <@${story.creator}>`)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("story_join").setLabel("🙋 เข้าร่วม").setStyle(ButtonStyle.Success))] });
        const dm = await sendMemberDMs(interaction.guild, `📖 มีแบบสำรวจสตอรี่ใหม่!\nวันเวลา: ${story.when}\nรายละเอียด: ${story.playing}\nไปที่ห้อง 📋・สำรวจคนเล่นสตอรี่ ใน Discord เพื่อเข้าร่วม`);
        return interaction.reply({ content: `สร้างแบบสำรวจแล้ว • DM สำเร็จ ${dm.ok} คน • ส่งไม่สำเร็จ ${dm.failed} คน${dm.reason ? ` • ${dm.reason}` : ""}`, ephemeral: true });
      }
      if (interaction.customId === "bank_add_submit" || interaction.customId === "bank_subtract_submit") {
        if (!isManager(interaction.member)) return interaction.reply({ content: "ไม่มีสิทธิ์จัดการบัญชี", ephemeral: true });
        const amount = Number(interaction.fields.getTextInputValue("amount").replace(/,/g, ""));
        const note = interaction.fields.getTextInputValue("note") || "-";
        if (!Number.isFinite(amount) || amount <= 0) return interaction.reply({ content: "กรุณาใส่จำนวนเงินเป็นตัวเลขมากกว่า 0", ephemeral: true });
        const sign = interaction.customId === "bank_add_submit" ? 1 : -1;
        if (db.bank.balance + amount * sign < 0) return interaction.reply({ content: "ยอดเงินไม่เพียงพอ", ephemeral: true });
        db.bank.balance += amount * sign;
        db.bank.ledger.push({ userId: interaction.user.id, amount: amount * sign, note, at: new Date().toISOString() }); saveDb();
        return interaction.reply({ content: `บันทึกแล้ว ${sign > 0 ? "รายรับ" : "รายจ่าย"} ${amount.toLocaleString("th-TH")} บาท\nยอดคงเหลือ ${db.bank.balance.toLocaleString("th-TH")} บาท`, ephemeral: true });
      }
    }
  } catch (e) {
    console.error("Interaction error:", e);
    const msg = "เกิดข้อผิดพลาดระหว่างทำรายการ กรุณาตรวจสอบ Console ของบอท";
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      try { await interaction.reply({ content: msg, ephemeral: true }); } catch {}
    }
  }
});

client.login(cfg.token);