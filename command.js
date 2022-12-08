const { SlashCommandBuilder } = require("discord.js");
const keys = require("./config")
const request = require("async-request");

module.exports = async function () {
    const voices = await request("https://api.su-shiki.com/v2/voicevox/speakers?key="+keys.voicevox_key)
    voices.body = JSON.parse(voices.body)
    const commands = [
        new SlashCommandBuilder()
            .setName("setvoice")
            .setDescription("Set TTS Voice")
            .addStringOption(o => o.setName("voice").setRequired(true).setDescription("Voice").addChoices())
    ]
    await voices.body.map(d=> commands[0].options[0].choices.push({ "name": d.name, "value": `${d.styles[0].id}` }))
    return commands
}
