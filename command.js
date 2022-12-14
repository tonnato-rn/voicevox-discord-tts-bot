const { SlashCommandBuilder } = require("discord.js");
const keys = require("./config")
const request = require("async-request");

module.exports = async function () {
    const voices = await request("https://tbot.tonnatorn.com/speakers")
    voices.body = JSON.parse(voices.body)
    const commands = [
        new SlashCommandBuilder()
            .setName("setvoice")
            .setDescription("Set TTS Voice")
    ]
    return commands
}
