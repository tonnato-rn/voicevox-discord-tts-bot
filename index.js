process.on("uncaughtException", (err) => console.log(err))
const keys = require("./config")
const discord = require('discord.js')
const request = require("request")
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
    client.application.commands.set(await require("./command")())
    const fs = require("fs")
    if (fs.existsSync("./lastconnections.json")) {
        const connections = JSON.parse(fs.readFileSync("./lastconnections.json", "utf-8"))
        connections.map(async d => {
            const channel = await client.channels.fetch(d.channelid)
            const guild = await client.guilds.fetch(d.guildid)
            const connection = voice.joinVoiceChannel({ guildId: d.guildid, channelId: d.channelid, adapterCreator: guild.voiceAdapterCreator })
            const queue = require("async").queue(function (data, callback) {
                const player = voice.createAudioPlayer()
                connection.subscribe(player)
                const { exec } = require("child_process")
                exec(`wget -O ${__dirname}/mp3/${data.id}.mp3 "https://api.su-shiki.com/v2/voicevox/audio?text=${data.content}&speaker=${data.voice || "3"}&key=${keys.voicevox_key}"`, async function () {
                    const audio = voice.createAudioResource(`${__dirname}/mp3/${data.id}.mp3`)
                    player.play(audio)
                    player.on("stateChange", async function (Old, New) {
                        if (New.status == "idle") {
                            callback()
                            require("fs").unlinkSync(`mp3/${data.id}.mp3`)
                        }
                    })
                })
            })
            const guildvoicedata = new keyv({ uri: "sqlite://voicedata", table: d.guildid })
            await queue.push({ id: `${d.guildid}_join`, content: "接続しました。", voice: null })
            client.on("voiceStateUpdate", async function (Old, New) {
                if (d.channelid == Old.channelId | d.channelid == New.channelId) {
                    if (connection.state.status=="destroyed") return
                    const voice = await guildvoicedata.get(New?.member?.user?.id || Old?.member?.user?.id)
                    const members = New.channel?.members?.map(d => d)
                    if (!members) return connection.destroy()
                    if (New.channelId == null && Old.channelId != null) queue.push({ content: `${New.member.nickname || New.member.user.username}さんが退出しました`, id: `${Old.guild.id}_${Old.member.id}_leave`, voice: voice })
                    if (New.channelId != null && Old.channelId == null) queue.push({ content: `${New.member.nickname || New.member.user.username}さんが入室しました`, id: `${Old.guild.id}_${Old.member.id}_join`, voice: voice })
                }
            })
            channel.createMessageCollector().on("collect", async function (message) {
                const voice = await guildvoicedata.get(message.member.user.id)
                let content = message.content.replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g, "url省略").replace(/```[\s\S]*```/g, "コード省略").replace(/<@.*>/g, "メンション").replace(/<#.*>/g, "チャンネル").replace(/<@&.*>/g, "ロール").replace(/(´・ω・｀)/g, "しょぼーん")
                if (message.attachments.map(d => d).length != 0) {
                    content = `${content}。添付ファイル`
                }
                if (message.reference) {
                    content = `リプライ。${content}`
                }
                if (content.length > 50) {
                    content = content.slice(0, 50) + "。以下省略"
                }
                if (!message.content.startsWith("v?")) if (!message.author.bot) queue.push({ id: message.id, content: content, voice: voice })
            })
        })
    }
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
            const { exec } = require("child_process")
            exec(`wget -O ${__dirname}/mp3/${data.id}.mp3 "https://api.su-shiki.com/v2/voicevox/audio?text=${data.content}&speaker=${data.voice || "3"}&key=${keys.voicevox_key}"`, async function () {
                const audio = voice.createAudioResource(`${__dirname}/mp3/${data.id}.mp3`)
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
                const members = New.channel?.members?.map(d => d)
                if (connection.state.status=="destroyed") return
                if (!members) return connection.destroy()
                const voice = await guildvoicedata.get(message.member.user.id)
                if (New.channelId == null && Old.channelId != null) queue.push({ content: `${New.member.nickname || New.member.user.username}さんが退出しました`, id: `${Old.guild.id}_${Old.member.id}_leave`, voice: voice })
                if (New.channelId != null && Old.channelId == null) queue.push({ content: `${New.member.nickname || New.member.user.username}さんが入室しました`, id: `${Old.guild.id}_${Old.member.id}_join`, voice: voice })
            }
        })
        message.channel.createMessageCollector().on("collect", async function (message) {
            const voice = await guildvoicedata.get(message.member.user.id)
            let content = message.content.replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g, "url省略").replace(/```[\s\S]*```/g, "コード省略").replace(/<@.*>/g, "メンション").replace(/<#.*>/g, "チャンネル").replace(/<@&.*>/g, "ロール").replace(/(´・ω・｀)/g, "しょぼーん")
            if (message.attachments.map(d => d).length != 0) {
                content = `${content}。添付ファイル`
            }
            if (message.reference) {
                content = `リプライ。${content}`
            }
            if (content.length > 50) {
                content = content.slice(0, 50) + "。以下省略"
            }
            if (!message.content.startsWith("v?")) if (!message.author.bot) queue.push({ id: message.id, content: content, voice: voice })
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
            const voice = interaction.options.getString("voice")
            const guildvoicedata = new keyv({ uri: "sqlite://voicedata", table: interaction.guildId })
            guildvoicedata.set(interaction.user.id, voice)
            interaction.reply({ content: "設定しました", ephemeral: true })
        }

    }
})
