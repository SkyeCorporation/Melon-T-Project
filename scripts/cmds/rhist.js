const fs = require("fs");
const path = require("path");

const brainPaths = [
        path.join(__dirname, "esdeathBrain.json"),
        path.join(__dirname, "esdeathBrain2.json")
];

function clearThreadHistory(filePath, threadID) {
        let brain;
        try {
                brain = JSON.parse(fs.readFileSync(filePath, "utf8"));
        } catch (error) {
                if (error.code === "ENOENT") return false;
                throw error;
        }

        if (!brain || typeof brain !== "object" || Array.isArray(brain))
                throw new Error(`${path.basename(filePath)} harus berisi object JSON.`);

        if (!Object.prototype.hasOwnProperty.call(brain, threadID)) return false;

        delete brain[threadID];
        const tempPath = `${filePath}.${process.pid}.tmp`;
        try {
                fs.writeFileSync(tempPath, `${JSON.stringify(brain, null, 2)}\n`);
                fs.renameSync(tempPath, filePath);
        } catch (error) {
                try { fs.unlinkSync(tempPath); } catch {}
                throw error;
        }
        return true;
}

module.exports = {
        config: {
                name: "rhist",
                version: "2.0.0",
                author: "Tora Tatsuki",
                countDown: 3,
                role: 0,
                botInstance: "amagi",
                description: "Hapus ingatan Esdeath untuk percakapan ini",
                category: "AI"
        },

        onStart: async function ({ api, event }) {
                const threadID = String(event.threadID || "");
                if (!threadID)
                        return api.sendMessage("ID percakapan tidak tersedia; ingatan tidak dihapus.", event.threadID);

                try {
                        const cleared = brainPaths.reduce(
                                (count, filePath) => count + Number(clearThreadHistory(filePath, threadID)),
                                0
                        );
                        const text = cleared
                                ? "Ingatan Esdeath untuk percakapan ini sudah dihapus."
                                : "Belum ada ingatan Esdeath untuk percakapan ini.";
                        return api.sendMessage(text, event.threadID, event.messageID);
                } catch (error) {
                        console.error("rhist error:", error.message || error);
                        return api.sendMessage("Gagal menghapus ingatan Esdeath. Periksa file riwayat di scripts/cmds.", event.threadID);
                }
        }
};
