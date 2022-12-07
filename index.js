const data = {
    token: "discord token",
    voicevoxtoken: "voicevox token"
}



process.on("uncaughtException", (err) => console.log(err))
const discord = require('discord.js')
const request = require("request")
const voice = require("@discordjs/voice")
const client = new discord.Client(require("discordjs-allintents-v14"))
client.login(data.token)

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
            exec(`wget -O ${__dirname}/mp3/${data.id}.mp3 "https://api.su-shiki.com/v2/voicevox/audio?text=${data.content}&speaker=8&key=${data.voicevoxtoken}"`, async function () {
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
        await queue.push({ id: `${message.guildId}_join`, content: "接続しました。" })
        client.on("voiceStateUpdate", async function(Old, New) {
            if (message.member.voice.channelId==Old.channelId | message.member.voice.channelId==New.channelId) {
                if (New.channelId==null && Old.channelId!=null) queue.push({ content: `${New.member.nickname||New.member.user.username}さんが退出しました`, id: `${Old.guild.id}_${Old.member.id}_leave` })
                if (New.channelId!=null && Old.channelId==null) queue.push({ content: `${New.member.nickname||New.member.user.username}さんが入室しました`, id: `${Old.guild.id}_${Old.member.id}_join` })
            }
        })
        message.channel.createMessageCollector().on("collect", async function (message) {
            let content = message.content.replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+/g,"url省略").replace(/```[\s\S]*```/g, "コード省略").replace(/<@.*>/g, "メンション").replace(/<#.*>/g, "チャンネル").replace(/<@&.*>/g, "ロール").replace(/(´・ω・｀)/g, "しょぼーん")
            if (message.attachments.map(d=>d).length!=0) {
                content = `${content}。添付ファイル`
            }
            if (message.reference) {
                content = `リプライ。${content}`
            }
            if (!message.content.startsWith("v?")) if (!message.author.bot) queue.push({ id: message.id, content: content })
        })
    } else if (message.content == "v?dc") {
        if (!message.member.voice.channel | !message.guild.members.me.voice.channel) return message.reply("ボイスチャンネルにいません。")
        const connection = voice.getVoiceConnection(message.guildId)
        connection.destroy()
    }
})

client.on("ready", async function() {
    console.log("Ready")
})
