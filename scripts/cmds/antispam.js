const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "..", "antiSpam.json");
const WINDOW_MS = 5000;
const MESSAGE_LIMIT = 8;
const messageWindows = new Map();
const activeActions = new Set();
let lastConfigError = "";
let lastPruneAt = 0;

function ensureConfigFile() {
        try {
                fs.writeFileSync(configPath, "[]\n", { flag: "wx" });
        } catch (error) {
                if (error.code !== "EEXIST") throw error;
        }
}

function readEnabledThreads() {
        ensureConfigFile();
        const stored = JSON.parse(fs.readFileSync(configPath, "utf8"));
        if (!Array.isArray(stored) || stored.some(id => typeof id !== "string" && typeof id !== "number"))
                throw new Error("antiSpam.json harus berisi array ID grup.");
        lastConfigError = "";
        return [...new Set(stored.map(String).filter(Boolean))];
}

function writeEnabledThreads(threadIDs) {
        const tempPath = `${configPath}.${process.pid}.tmp`;
        try {
                fs.writeFileSync(tempPath, `${JSON.stringify([...new Set(threadIDs.map(String))], null, 2)}\n`);
                fs.renameSync(tempPath, configPath);
                lastConfigError = "";
        } catch (error) {
                try {
                        fs.unlinkSync(tempPath);
                } catch {}
                throw error;
        }
}

function normalizeIDs(values) {
        if (!Array.isArray(values)) return new Set();
        return new Set(values.map(value => {
                if (value && typeof value === "object")
                        return String(value.id ?? value.userID ?? value.uid ?? "");
                return String(value ?? "");
        }).filter(Boolean));
}

function getBotAdminIDs() {
        return normalizeIDs(global.GoatBot?.config?.adminBot);
}

function getMessageKey(threadID, senderID) {
        return `${threadID}:${senderID}`;
}

async function handleSpam(api, event, senderID, usersData) {
        const threadID = String(event.threadID);
        const threadInfo = await api.getThreadInfo(event.threadID);
        const groupAdmins = normalizeIDs(threadInfo?.adminIDs);
        const botID = String(api.getCurrentUserID?.() || "");

        if (!botID)
                throw new Error("ID bot tidak tersedia; tindakan anti-spam dibatalkan.");

        let userInfo = null;
        if (typeof usersData?.get === "function") {
                try {
                        userInfo = await usersData.get(senderID);
                } catch (error) {
                        console.error(`Anti-spam: gagal membaca nama anggota ${senderID}:`, error.message || error);
                }
        }
        const threadUser = (threadInfo?.userInfo || []).find(member =>
                String(member?.id ?? member?.userID ?? member?.uid ?? "") === String(senderID)
        );
        const userName = userInfo?.name
                || userInfo?.fullName
                || threadUser?.name
                || threadUser?.fullName
                || `anggota ${senderID}`;
        const groupName = threadInfo?.threadName || threadInfo?.name || "grup ini";
        const botIsAdmin = groupAdmins.has(botID);
        const reason = `mengirim ${MESSAGE_LIMIT} pesan dalam ${WINDOW_MS / 1000} detik`;

        try {
                const esdeath = require("./esdeath");
                const warning = await esdeath.generateSpamModerationReply({
                        senderID,
                        userName,
                        groupName,
                        reason,
                        willKick: botIsAdmin
                });
                await api.sendMessage(warning, event.threadID, event.messageID);
        } catch (error) {
                console.error("Anti-spam: Esdeath gagal membuat atau mengirim teguran:", error.message || error);
        }

        if (botIsAdmin) {
                await api.removeUserFromGroup(senderID, event.threadID);
                console.log(`Anti-spam: mengeluarkan ${senderID} dari grup ${threadID}.`);
                return;
        }

        await api.removeUserFromGroup(botID, event.threadID);
        console.log(`Anti-spam: bot ${botID} keluar dari grup ${threadID} setelah mendeteksi spam.`);
}

module.exports = {
        config: {
                name: "asp",
                version: "1.0.0",
                author: "Custom",
                countDown: 3,
                role: 0,
                botInstance: "amagi",
                description: "Aktifkan atau matikan pemantauan anti-spam grup",
                category: "moderation",
                guide: "{pn} [on|off|status]"
        },

        onStart: async function ({ api, event, args }) {
                const threadID = String(event.threadID || "");
                const senderID = String(event.senderID || "");
                if (!threadID || threadID === senderID)
                        return api.sendMessage("Perintah ini hanya dapat digunakan di grup.", event.threadID);

                let threadInfo;
                try {
                        threadInfo = await api.getThreadInfo(event.threadID);
                } catch (error) {
                        return api.sendMessage("Tidak dapat membaca daftar admin grup.", event.threadID);
                }

                const groupAdmins = normalizeIDs(threadInfo?.adminIDs);
                if (!groupAdmins.has(senderID) && !getBotAdminIDs().has(senderID))
                        return api.sendMessage("Hanya admin grup atau admin bot yang dapat mengatur anti-spam.", event.threadID);

                const action = (args?.[0] || "on").toLowerCase();
                if (!["on", "off", "status"].includes(action))
                        return api.sendMessage("Gunakan: .asp [on|off|status]", event.threadID);

                let enabledThreads;
                try {
                        enabledThreads = readEnabledThreads();
                } catch (error) {
                        console.error("Anti-spam: gagal membaca antiSpam.json:", error.message || error);
                        return api.sendMessage("antiSpam.json tidak valid atau tidak dapat dibaca. Periksa file di folder utama.", event.threadID);
                }

                const isEnabled = enabledThreads.includes(threadID);
                if (action === "status")
                        return api.sendMessage(isEnabled
                                ? "Anti-spam aktif di grup ini (8 pesan dalam 5 detik)."
                                : "Anti-spam belum aktif di grup ini.", event.threadID);

                const shouldEnable = action === "on";
                if (shouldEnable === isEnabled)
                        return api.sendMessage(shouldEnable
                                ? "Anti-spam sudah aktif di grup ini."
                                : "Anti-spam memang sudah nonaktif di grup ini.", event.threadID);

                const nextThreads = shouldEnable
                        ? [...enabledThreads, threadID]
                        : enabledThreads.filter(id => id !== threadID);
                try {
                        writeEnabledThreads(nextThreads);
                } catch (error) {
                        console.error("Anti-spam: gagal menyimpan antiSpam.json:", error.message || error);
                        return api.sendMessage("Gagal menyimpan pengaturan ke antiSpam.json.", event.threadID);
                }

                return api.sendMessage(shouldEnable
                        ? "Anti-spam aktif di grup ini: 8 pesan dari satu anggota dalam 5 detik. Jika bot admin, pengirim akan dikeluarkan; jika bukan, bot akan keluar dari grup."
                        : "Anti-spam dinonaktifkan di grup ini.", event.threadID);
        },

        onChat: async function ({ api, event, usersData }) {
                const threadID = String(event.threadID || "");
                const senderID = String(event.senderID || "");
                if (!threadID || !senderID || threadID === senderID) return;

                let enabledThreads;
                try {
                        enabledThreads = readEnabledThreads();
                } catch (error) {
                        const errorMessage = error.message || String(error);
                        if (lastConfigError !== errorMessage) {
                                lastConfigError = errorMessage;
                                console.error("Anti-spam: pemantauan dihentikan karena antiSpam.json tidak valid:", errorMessage);
                        }
                        return;
                }
                if (!enabledThreads.includes(threadID)) return;

                let botID = "";
                try {
                        botID = String(api.getCurrentUserID?.() || "");
                } catch {}
                if (senderID === botID) return;

                const key = getMessageKey(threadID, senderID);
                if (activeActions.has(key)) return;

                const now = Date.now();
                if (messageWindows.size > 1000 && now - lastPruneAt > WINDOW_MS) {
                        lastPruneAt = now;
                        for (const [cachedKey, timestamps] of messageWindows) {
                                const fresh = timestamps.filter(timestamp => now - timestamp <= WINDOW_MS);
                                if (fresh.length) messageWindows.set(cachedKey, fresh);
                                else messageWindows.delete(cachedKey);
                        }
                }
                const recentMessages = (messageWindows.get(key) || [])
                        .filter(timestamp => now - timestamp <= WINDOW_MS);
                recentMessages.push(now);
                messageWindows.set(key, recentMessages);

                if (recentMessages.length < MESSAGE_LIMIT) return;

                messageWindows.delete(key);
                activeActions.add(key);
                try {
                        await handleSpam(api, event, senderID, usersData);
                } catch (error) {
                        console.error(`Anti-spam: tindakan gagal di grup ${threadID}:`, error.message || error);
                } finally {
                        activeActions.delete(key);
                }
        }
};
