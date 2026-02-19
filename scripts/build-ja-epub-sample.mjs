import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import JSZip from "jszip";
import { Agent } from "undici";

const fixturePath = process.env.FIXTURE_PATH ?? "src/__tests__/fixtures/jane_tyre.md";
const outputPath = process.env.OUTPUT_PATH ?? "tmp/jane-eyre-ja-vertical-sample.epub";
const chapterLimit = Number(process.env.CHAPTER_LIMIT ?? "6");
const chapterMaxLines = Number(process.env.CHAPTER_MAX_LINES ?? "28");
const useOllama = process.env.USE_OLLAMA !== "0";
const ollamaEndpoint = process.env.OLLAMA_ENDPOINT ?? "http://127.0.0.1:11434";
const ollamaModel = process.env.OLLAMA_MODEL ?? "translategemma";
const ollamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? "600000");
const ollamaRetry = Number(process.env.OLLAMA_RETRY ?? "2");
const continueOnError = process.env.CONTINUE_ON_ERROR !== "0";
const ollamaDispatcher = new Agent({
  connectTimeout: 30_000,
  headersTimeout: ollamaTimeoutMs,
  bodyTimeout: ollamaTimeoutMs,
});

function resolveLanguageCode(languageName) {
  const map = {
    English: "en",
    Japanese: "ja",
  };
  return map[languageName] ?? languageName.toLowerCase().replace(/\s+/g, "-");
}

function buildTranslategemmaPrompt(sourceLanguage, targetLanguage, sourceText) {
  const sourceCode = resolveLanguageCode(sourceLanguage);
  const targetCode = resolveLanguageCode(targetLanguage);
  return `You are a professional ${sourceLanguage} (${sourceCode}) to ${targetLanguage} (${targetCode}) translator. Your goal is to accurately convey the meaning and nuances of the original ${sourceLanguage} text while adhering to ${targetLanguage} grammar, vocabulary, and cultural sensitivities.
Produce only the ${targetLanguage} translation, without any additional explanations or commentary. Please translate the following ${sourceLanguage} text into ${targetLanguage}:


${sourceText}`;
}

function splitByChapter(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let title = "";
  let current = [];

  const push = () => {
    const body = current.join("\n").trim();
    if (!title || !body) return;
    sections.push({ title, markdown: body });
  };

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      push();
      title = match[1].trim();
      current = [line];
      continue;
    }
    if (title) {
      current.push(line);
    }
  }
  push();
  return sections;
}

function xmlEscape(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function markdownToSimpleHtml(markdown) {
  const blocks = markdown.trim().split(/\n{2,}/);
  return blocks.map((block) => {
    const heading = block.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(6, heading[1].length);
      return `<h${level}>${xmlEscape(heading[2].trim())}</h${level}>`;
    }
    return `<p>${xmlEscape(block.replace(/\n/g, " ").trim())}</p>`;
  }).join("\n");
}

async function translateToJapanese(markdown) {
  if (!useOllama) {
    return markdown;
  }
  const prompt = buildTranslategemmaPrompt("English", "Japanese", markdown);

  let attempt = 0;
  let lastError = null;
  while (attempt <= ollamaRetry) {
    try {
      const response = await fetch(`${ollamaEndpoint.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          prompt,
          stream: false,
        }),
        dispatcher: ollamaDispatcher,
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Ollama 调用失败：${response.status} ${message}`);
      }
      const data = await response.json();
      return String(data.response ?? "").trim();
    } catch (error) {
      lastError = error;
      if (attempt >= ollamaRetry) {
        break;
      }
      const backoff = Math.min(2000 * (attempt + 1), 8000);
      console.warn(`Ollama 翻译失败，准备重试（${attempt + 1}/${ollamaRetry}），等待 ${backoff}ms`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
    attempt += 1;
  }

  throw lastError ?? new Error("Ollama 调用失败");
}

function createChapterXhtml(chapter) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
  <head>
    <meta charset="utf-8"/>
    <title>${xmlEscape(chapter.title)}</title>
    <link rel="stylesheet" type="text/css" href="styles.css"/>
  </head>
  <body>
    <h1>${xmlEscape(chapter.title)}</h1>
    <section>
      <h2>原文</h2>
      ${markdownToSimpleHtml(chapter.sourceMarkdown)}
    </section>
    <section>
      <h2>日本語訳</h2>
      ${markdownToSimpleHtml(chapter.targetMarkdown)}
    </section>
  </body>
</html>`;
}

async function buildEpub(chapters) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const oebps = zip.folder("OEBPS");
  oebps.file(
    "styles.css",
    "body{font-family:'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif;line-height:1.9;writing-mode:vertical-rl;-epub-writing-mode:vertical-rl;text-orientation:mixed;direction:rtl;}h1,h2{page-break-after:avoid;line-break:strict;}section{margin-left:1.2em;}p{margin:0 0 0.9em 0;}",
  );

  chapters.forEach((chapter, index) => {
    oebps.file(`chapter-${index + 1}.xhtml`, createChapterXhtml(chapter));
  });

  const manifestItems = chapters.map((_, index) => (
    `<item id="c${index + 1}" href="chapter-${index + 1}.xhtml" media-type="application/xhtml+xml"/>`
  )).join("\n    ");
  const spineItems = chapters.map((_, index) => `<itemref idref="c${index + 1}"/>`).join("\n    ");
  const navList = chapters.map((chapter, index) => (
    `<li><a href="chapter-${index + 1}.xhtml">${xmlEscape(chapter.title)}</a></li>`
  )).join("");
  const navPoints = chapters.map((chapter, index) => (
    `    <navPoint id="n${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${xmlEscape(chapter.title)}</text></navLabel>
      <content src="chapter-${index + 1}.xhtml"/>
    </navPoint>`
  )).join("\n");

  oebps.file(
    "toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="fixture-ja-vertical-sample"/></head>
  <docTitle><text>Jane Eyre 日文竖排样例</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`,
  );

  oebps.file(
    "nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
  <head><meta charset="utf-8"/><title>目次</title></head>
  <body>
    <nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops">
      <h1>目次</h1>
      <ol>${navList}</ol>
    </nav>
  </body>
</html>`,
  );

  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="bookid" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">fixture-ja-vertical-sample</dc:identifier>
    <dc:title>Jane Eyre 日文竖排样例</dc:title>
    <dc:language>ja</dc:language>
    <dc:creator>iTranslate</dc:creator>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="styles.css" media-type="text/css"/>
    ${manifestItems}
  </manifest>
  <spine toc="ncx" page-progression-direction="rtl">
    ${spineItems}
  </spine>
</package>`,
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buffer);
}

async function main() {
  const fixture = readFileSync(fixturePath, "utf8");
  const chapters = splitByChapter(fixture)
    .filter((entry) => entry.markdown.length > 180)
    .slice(0, Math.max(1, chapterLimit));

  if (chapters.length === 0) {
    throw new Error("fixture 中没有可用章节");
  }

  console.log(`开始构建日文竖排 EPUB，章节数=${chapters.length}，USE_OLLAMA=${useOllama ? "1" : "0"}`);
  console.log(`参数：CHAPTER_MAX_LINES=${chapterMaxLines} OLLAMA_TIMEOUT_MS=${ollamaTimeoutMs} OLLAMA_RETRY=${ollamaRetry} CONTINUE_ON_ERROR=${continueOnError ? "1" : "0"}`);
  const translated = [];
  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    const sourceMarkdown = chapter.markdown.split("\n").slice(0, Math.max(8, chapterMaxLines)).join("\n");
    console.log(`[${index + 1}/${chapters.length}] 处理章节：${chapter.title}`);
    let targetMarkdown = sourceMarkdown;
    try {
      targetMarkdown = await translateToJapanese(sourceMarkdown);
    } catch (error) {
      if (!continueOnError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${index + 1}/${chapters.length}] 章节翻译失败，使用原文回退：${message}`);
    }
    translated.push({
      title: chapter.title,
      sourceMarkdown,
      targetMarkdown: targetMarkdown || sourceMarkdown,
    });
  }

  await buildEpub(translated);
  console.log(`已生成样例文件：${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
