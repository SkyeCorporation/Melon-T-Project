const { AIHorde } = require("@zeldafan0225/ai_horde");
const axios = require("axios");
const { Readable } = require("stream");

const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 15 * 60 * 1000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_COUNT_LIMIT = 4;

const aiHorde = new AIHorde({
  client_agent: "GoatBot:1.0"
});

function normalizeDimension(value) {
  return Math.max(64, Math.min(3072, Math.round(value / 64) * 64));
}

function parseImageArgs(args) {
  const options = {
    width: 512,
    height: 512,
    steps: 20,
    n: 1,
    cfg_scale: 7
  };
  const requestedDimensions = { width: options.width, height: options.height };
  const promptParts = [];
  const supportedOptions = new Set(["width", "height", "steps", "n", "cfg-scale"]);

  for (let index = 0; index < args.length; index++) {
    const token = String(args[index]);
    const match = token.match(/^--([a-z][a-z0-9_-]*)(?:=(.*))?$/i);

    if (!match) {
      promptParts.push(token);
      continue;
    }

    const optionName = match[1].toLowerCase().replace(/_/g, "-");
    if (!supportedOptions.has(optionName)) {
      promptParts.push(token);
      continue;
    }

    let rawValue = match[2];
    if (rawValue === undefined) {
      const nextToken = args[index + 1];
      if (nextToken === undefined || String(nextToken).startsWith("--"))
        throw new Error(`Nilai untuk --${optionName} belum diisi.`);
      rawValue = String(nextToken);
      index++;
    }

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue))
      throw new Error(`Nilai --${optionName} harus berupa angka.`);

    if (optionName === "width" || optionName === "height") {
      if (!Number.isInteger(numericValue) || numericValue < 64 || numericValue > 3072)
        throw new Error(`--${optionName} harus bilangan bulat antara 64 dan 3072.`);
      requestedDimensions[optionName] = numericValue;
      options[optionName] = normalizeDimension(numericValue);
    } else if (optionName === "steps") {
      if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 500)
        throw new Error("--steps harus bilangan bulat antara 1 dan 500.");
      options.steps = numericValue;
    } else if (optionName === "n") {
      if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > IMAGE_COUNT_LIMIT)
        throw new Error(`--n harus bilangan bulat antara 1 dan ${IMAGE_COUNT_LIMIT}.`);
      options.n = numericValue;
    } else if (optionName === "cfg-scale") {
      if (numericValue < 0 || numericValue > 100)
        throw new Error("--cfg_scale harus berada antara 0 dan 100.");
      options.cfg_scale = Math.round(numericValue * 100) / 100;
    }
  }

  const prompt = promptParts.join(" ").trim();
  if (!prompt)
    throw new Error("Masukkan prompt gambar terlebih dahulu.");
  if (prompt.length > 2000)
    throw new Error("Prompt terlalu panjang; batasnya 2000 karakter.");

  return { prompt, options, requestedDimensions };
}

function getImageExtension(mimeType) {
  const mime = String(mimeType || "").split(";")[0].trim().toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/gif") return "gif";
  return "webp";
}

async function getImageBuffer(imageValue) {
  if (typeof imageValue !== "string" || !imageValue.trim())
    throw new Error("AI Horde tidak mengembalikan data gambar.");

  const image = imageValue.trim();
  let buffer;
  let mimeType = "image/webp";

  if (/^data:/i.test(image)) {
    const dataUrl = image.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
    if (!dataUrl)
      throw new Error("Format data gambar dari AI Horde tidak dikenali.");
    mimeType = dataUrl[1];
    buffer = Buffer.from(dataUrl[2], "base64");
  } else if (/^https?:\/\//i.test(image)) {
    const imageUrl = new URL(image);
    if (imageUrl.protocol !== "https:")
      throw new Error("Tautan hasil gambar harus menggunakan HTTPS.");

    const response = await axios.get(image, {
      responseType: "arraybuffer",
      timeout: 45000,
      maxContentLength: MAX_IMAGE_BYTES,
      maxBodyLength: MAX_IMAGE_BYTES
    });
    mimeType = response.headers?.["content-type"] || mimeType;
    if (!String(mimeType).toLowerCase().startsWith("image/"))
      throw new Error("Tautan hasil AI Horde tidak berisi gambar.");
    buffer = Buffer.from(response.data);
  } else {
    const base64 = image.replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/=_-]+$/.test(base64))
      throw new Error("Data gambar base64 dari AI Horde tidak valid.");
    buffer = Buffer.from(base64, "base64");
  }

  if (!buffer?.length || buffer.length > MAX_IMAGE_BYTES)
    throw new Error("Ukuran hasil gambar kosong atau melebihi batas 20 MB.");

  return { buffer, extension: getImageExtension(mimeType) };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getUsage(commandName) {
  return `Cara pakai:
${commandName} <prompt> [opsi]

Contoh:
${commandName} cyberpunk city at night --width 340 --height 130 --steps 20 --n 1 --cfg_scale 7

Opsi: --width, --height, --steps, --n (maks. ${IMAGE_COUNT_LIMIT}), --cfg_scale
Ukuran gambar disesuaikan ke kelipatan 64 yang diterima AI Horde.`;
}

module.exports = {
  config: {
    name: "imagen",
    version: "1.0.0",
    author: "Tora Tatsuki",
    countDown: 15,
    role: 0,
    description: "Buat gambar melalui AI Horde dengan ukuran dan parameter dinamis",
    category: "AI",
    guide: {
      en: "{pn} <prompt> [--width 512] [--height 512] [--steps 20] [--n 1] [--cfg_scale 7]"
    }
  },

  onStart: async function ({ api, args, event, commandName }) {
    let request;
    try {
      request = parseImageArgs(args || []);
    } catch (error) {
      return api.sendMessage(`${error.message}\n\n${getUsage(commandName || ".imagen")}`, event.threadID, event.messageID);
    }

    const { prompt, options, requestedDimensions } = request;
    const { width: originalWidth, height: originalHeight } = requestedDimensions;
    const dimensionsAdjusted = originalWidth !== options.width || originalHeight !== options.height;
    const dimensionsNotice = dimensionsAdjusted
      ? ` (ukuran disesuaikan dari ${originalWidth}×${originalHeight} ke ${options.width}×${options.height}, kelipatan 64)`
      : "";
    let sentCount = 0;

    try {
      await api.sendMessage(
        `Mengirim permintaan gambar ke AI Horde. Ukuran ${options.width}×${options.height}, ${options.steps} steps, ${options.n} gambar${dimensionsNotice}.`,
        event.threadID,
        event.messageID
      );

      const generation = await aiHorde.postAsyncImageGenerate({
        prompt,
        params: {
          width: options.width,
          height: options.height,
          steps: options.steps,
          n: options.n,
          cfg_scale: options.cfg_scale
        },
        nsfw: false,
        censor_nsfw: true
      });

      if (!generation?.id)
        throw new Error(generation?.message || "AI Horde tidak memberikan ID pekerjaan.");

      const deadline = Date.now() + MAX_WAIT_MS;
      let status;
      do {
        await sleep(POLL_INTERVAL_MS);
        status = await aiHorde.getImageGenerationCheck(generation.id, { force: true });

        if (status?.faulted)
          throw new Error("AI Horde melaporkan pekerjaan gambar gagal.");
        if (status?.is_possible === false)
          throw new Error("Saat ini tidak ada worker yang dapat memproses permintaan tersebut.");
        if (status?.done)
          break;
      } while (Date.now() < deadline);

      if (!status?.done)
        throw new Error("Antrean AI Horde melewati batas tunggu 15 menit. Coba lagi nanti.");

      const result = await aiHorde.getImageGenerationStatus(generation.id, { force: true });
      const generations = Array.isArray(result?.generations) ? result.generations.slice(0, options.n) : [];
      if (!generations.length)
        throw new Error("Pekerjaan selesai, tetapi AI Horde tidak mengembalikan gambar.");

      for (const generated of generations) {
        const { buffer, extension } = await getImageBuffer(generated.img);
        const imageStream = Readable.from(buffer);
        imageStream.path = `imagen.${extension}`;
        await api.sendMessage({ attachment: imageStream }, event.threadID, event.messageID);
        sentCount++;
      }

      if (sentCount < options.n) {
        await api.sendMessage(
          `AI Horde hanya mengembalikan ${sentCount} dari ${options.n} gambar yang diminta.`,
          event.threadID,
          event.messageID
        );
      }
    } catch (error) {
      console.error("imagen error:", error.message || error);
      const message = String(error.message || "Terjadi kesalahan saat membuat gambar.").slice(0, 400);
      const resultNote = sentCount ? ` (${sentCount} gambar sudah terkirim sebelum error)` : "";
      await api.sendMessage(`Gagal membuat gambar${resultNote}: ${message}`, event.threadID, event.messageID);
    }
  }
};
