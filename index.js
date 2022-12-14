process.on("uncaughtException", (err) => console.log(err))
const keys = require("./config")
const discord = require('discord.js')
const request = require("async-request")
const voice = require("@discordjs/voice")
const keyv = require("keyv")
const client = new discord.Client(require("discordjs-allintents-v14"))
client.login(keys.token)

process.on("SIGINT", async function (signal) {
    const fs = require("fs")
    const arr = []
    await voice.getVoiceConnections().forEach(d => {
        arr.push({ guildid: d.joinConfig.guildId, channelid: d.joinConfig.channelId })
    })
    await fs.writeFileSync("./lastconnections.json", await JSON.stringify(arr), { encoding: "utf-8" })
    await voice.getVoiceConnections().forEach(data => data.destroy())
    process.exit()
})

client.on("ready", async function () {
    console.log("ready")
    delete require.cache[require.resolve("./command")]
    const commands = await require("./command")()
    client.application.commands.set(commands)
})

client.on("messageCreate", async function (message) {
    if (message.author.bot) return

    if (message.content == "v?join") {
        if (message.guild.members.me.voice.channel) return message.reply("すでにボイスチャンネルにいます。")
        if (!message.member.voice.channel) return message.reply("ボイスチャンネルに参加してください")
        const connection = voice.joinVoiceChannel({ guildId: message.guildId, channelId: message.member.voice.channelId, adapterCreator: message.guild.voiceAdapterCreator })
        const queue = require("async").queue(function (data, callback) {
            const player = voice.createAudioPlayer()
            connection.subscribe(player)
            const genaudio = require("./genaudio")
            genaudio(data.content, `${__dirname}/mp3/${data.id}.mp3`, data.voice).then(() => {
                const audio = voice.createAudioResource(`${__dirname}/mp3/${data.id}.mp3`, { inlineVolume: true })
                audio.volume.setVolume(2)
                player.play(audio)
                player.on("stateChange", async function (Old, New) {
                    if (New.status == "idle") {
                        callback()
                        require("fs").unlinkSync(`mp3/${data.id}.mp3`)
                    }
                })
            })
        })
        const guildvoicedata = new keyv({ uri: "sqlite://voicedata", table: message.guildId })
        await queue.push({ id: `${message.guildId}_join`, content: "接続しました。", voice: await guildvoicedata.get(message.member.user.id) })
        client.on("voiceStateUpdate", async function (Old, New) {
            if (message.member.voice.channelId == Old.channelId | message.member.voice.channelId == New.channelId) {
                let members = New.channel?.members?.map(d => d) || Old.channel?.members?.map(d => d)
                members = members.filter(d => d.user.id != client.user.id)
                if (connection.state.status == "destroyed") return
                if (!members.length) return connection.destroy()
                const voice = await guildvoicedata.get(message.member.user.id)
                if (New.channelId == null && Old.channelId != null) queue.push({ content: `${New.member.nickname || New.member.user.username}さんが退出しました`, id: `${Old.guild.id}_${Old.member.id}_leave`, voice: voice })
                if (New.channelId != null && Old.channelId == null) queue.push({ content: `${New.member.nickname || New.member.user.username}さんが入室しました`, id: `${Old.guild.id}_${Old.member.id}_join`, voice: voice })
            }
        })
        message.channel.createMessageCollector().on("collect", async function (message) {
            const voice = await guildvoicedata.get(message.member.user.id)
            let content = message.content.replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g, "url省略").replace(/```[\s\S]*```/g, "コード省略").replace(/(´・ω・｀)/g, "しょぼーん")
            message.mentions.users.map(async d => {
                content = content.replace(`<@${d.id}>`, `@${d.username}`)
            })
            message.mentions.roles.map(async d => {
                content = content.replace(`<@&${d.id}>`, `@${d.name}`)
            })
            message.mentions.channels.map(async d => {
                content = content.replace(`<#${d.id}>`, `#${d.name}`)
            })
            if (message.attachments.map(d => d).length != 0) {
                content = `${content}。添付ファイル`
            }
            if (message.reference) {
                content = `リプライ。${content}`
            }
            if (content.length > 1000) {
                content = content.slice(0, 50) + "。以下省略"
            }
            if (!message.content.startsWith("v?")) if (!message.author.bot) queue.push({ id: message.id, content: content, voice: voice })
            if (message.content == "v?weather") {
                message.reply("音声の生成には時間がかかります。お待ちください。")
                const request = require("request")
                request.get({
                    url: `https://www.jma.go.jp/bosai/forecast/data/forecast/130000.json`, json: true
                }, function (err, res, body) {
                    if (res.statusCode == 200) {
                        request.get({
                            url: `https://www.jma.go.jp/bosai/forecast/data/overview_forecast/130000.json`,
                            json: true
                        }, function (er, re, bod) {
                            if (re.statusCode == 200) {
                                const area = body[0].timeSeries[0].areas[0]
                                queue.push({ content: bod.text.replace(/\n/, "。"), id: message.id, voice: voice})
                            } else { interaction.reply({ content: "エラーが発生しました:(", ephemeral: true }) }
                        });
                    } else { interaction.reply({ content: "エラーが発生しました:(", ephemeral: true }) }
                })
            }
        })
    } else if (message.content == "v?dc") {
        if (!message.member.voice.channel | !message.guild.members.me.voice.channel) return message.reply("ボイスチャンネルにいません。")
        const connection = voice.getVoiceConnection(message.guildId)
        connection.destroy()
    }
})

client.on("interactionCreate", async function (interaction) {
    if (interaction.isCommand()) {
        const cn = interaction.commandName
        if (cn == "setvoice") {
            const request = require("async-request")
            let voices = await request("https://voicevox.tonnatorn.com/speakers")
            voices.body = JSON.parse(voices.body)
            let voicess = []
            voices.body.map(d1 => d1.styles.map(d2 => ({ label: d2.name + d1.name, value: `${d2.id}` })).map(d => voicess.push(d)))
            voicess = voicess.slice(0, 25)
            const select = new discord.StringSelectMenuBuilder()
                .setCustomId("setvoice-select")
                .addOptions(voices.body.map(d => ({ label: d.name, value: String(d.speaker_uuid) })))
            interaction.reply({ components: [new discord.ActionRowBuilder().addComponents(select)], ephemeral: true })
        }
    } else if (interaction.isStringSelectMenu()) {
        const ci = interaction.customId
        if (ci == "setvoice-select") {
            let voices = await request("https://voicevox.tonnatorn.com/speakers")
            voices.body = JSON.parse(voices.body)
            const styles = voices.body.filter(d => d.speaker_uuid == interaction.values[0])[0]?.styles
            if (!styles) return interaction.reply({ content: "エラーが発生しました", ephemeral: true })
            const select = new discord.StringSelectMenuBuilder()
                .setCustomId("setvoice-select-style")
                .addOptions(
                    styles.map(d => ({ label: d.name, value: String(d.id) }))
                )
            interaction.reply({ components: [new discord.ActionRowBuilder().addComponents(select)], ephemeral: true })
        } else if (ci == "setvoice-select-style") {
            const data = new keyv("sqlite://voicedata", { table: interaction.guildId })
            await data.set(interaction.user.id, interaction.values[0])
            interaction.reply({ content: "設定しました。", ephemeral: true })
        }
    }
})
