const { default: axios } = require("axios"); const fs = require("fs");
const rpc = axios.create({ baseURL: "https://voicevox.tonnatorn.com", proxy: false })
module.exports = async function genAudio(text, filepath, speaker) {
    const audio_query = await rpc.post('audio_query?text=' + encodeURI(text) + '&speaker=' + speaker || "1")
    const synthesis = await rpc.post("synthesis?speaker=" + speaker || "1", JSON.stringify(audio_query.data), {
        responseType: 'arraybuffer',
        headers: {
            "accept": "audio/wav",
            "Content-Type": "application/json"
        }
    })
    fs.writeFileSync(filepath, new Buffer.from(synthesis.data))
}
