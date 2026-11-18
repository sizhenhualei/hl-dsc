import * as CFB from 'cfb'
import mammoth from 'mammoth'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs'

// PDF.js 体积很大，且使用了较新的类语法。按需动态加载，避免旧版
// Android WebView 在启动时解析 PDF.js 失败而直接白屏。
let pdfJsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null
const loadPdfJs = () => {
  pdfJsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((module) => {
    module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    return module
  })
  return pdfJsPromise
}

/** 单个附件最多注入模型的字符数，避免超长合同/论文直接撑爆上下文。 */
export const MAX_DOCUMENT_CHARS = 80_000
/** 纯文本附件读取上限；超过后只读前 2MB。 */
const MAX_TEXT_BYTES = 2 * 1024 * 1024

export type DocumentKind = 'pdf' | 'docx' | 'doc' | 'text'

export type ExtractedDocument = {
  kind: DocumentKind
  text: string
  truncated: boolean
}

export const DOCUMENT_EXTS = new Set(['pdf', 'doc', 'docx'])

export const getFileExtension = (name: string) => {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1).toLowerCase() : ''
}

const truncate = (text: string): { text: string; truncated: boolean } => {
  const normalized = text.replace(/\r\n?/g, '\n').split('\u0000').join('').trim()
  if (normalized.length <= MAX_DOCUMENT_CHARS) {
    return { text: normalized, truncated: false }
  }
  return {
    text: `${normalized.slice(0, MAX_DOCUMENT_CHARS)}\n\n[内容过长，已截断，仅保留前 ${MAX_DOCUMENT_CHARS} 字]`,
    truncated: true,
  }
}

/* -------------------------------------------------------------------------- */
/* PDF                                                                        */
/* -------------------------------------------------------------------------- */

const extractPdfText = async (blob: Blob): Promise<string> => {
  const data = new Uint8Array(await blob.arrayBuffer())
  const pdfjs = await loadPdfJs()
  const task = pdfjs.getDocument({
    data,
    useSystemFonts: true,
  })
  try {
    const document = await task.promise
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      let pageText = ''
      for (const item of content.items) {
        if (!('str' in item)) {
          continue
        }
        const value = item.str
        if (!value) {
          continue
        }
        const needsSpace =
          pageText.length > 0 &&
          !/\s$/.test(pageText) &&
          !/^[\s，。！？、；：,.!?;:)\]}》」』】]$/.test(value) &&
          !/[（(《「『【]$/.test(pageText)
        pageText += `${needsSpace ? ' ' : ''}${value}`
        if (item.hasEOL) {
          pageText += '\n'
        }
      }
      page.cleanup()
      pages.push(pageText.trim())
    }
    return pages.filter(Boolean).join('\n\n')
  } finally {
    await task.destroy()
  }
}

/* -------------------------------------------------------------------------- */
/* DOCX                                                                       */
/* -------------------------------------------------------------------------- */

const extractDocxText = async (blob: Blob): Promise<string> => {
  const result = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() })
  return result.value
}

/* -------------------------------------------------------------------------- */
/* Legacy .doc (OLE / Word 97 binary)                                         */
/* -------------------------------------------------------------------------- */

const readU16 = (data: Uint8Array, offset: number) =>
  (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8)

const readU32 = (data: Uint8Array, offset: number) =>
  ((data[offset] ?? 0) |
    ((data[offset + 1] ?? 0) << 8) |
    ((data[offset + 2] ?? 0) << 16) |
    ((data[offset + 3] ?? 0) << 24)) >>>
  0

const cleanWordText = (text: string) => {
  let output = ''
  let inFieldInstruction = false
  for (const char of text) {
    const code = char.charCodeAt(0)
    // Word 的域结构：0x13 指令开始，0x14 结果开始，0x15 结束。
    if (code === 0x13) {
      inFieldInstruction = true
      continue
    }
    if (code === 0x14) {
      inFieldInstruction = false
      continue
    }
    if (code === 0x15) {
      continue
    }
    if (inFieldInstruction) {
      continue
    }
    if (code === 0x07) {
      output += '\t'
      continue
    }
    if (code === 0x0b || code === 0x0c) {
      output += '\n'
      continue
    }
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      continue
    }
    output += char
  }
  return output.replace(/\n{3,}/g, '\n\n')
}

const decodeWordPieces = (word: Uint8Array, table: Uint8Array): string => {
  const fcClx = readU32(word, 0x01a2)
  const lcbClx = readU32(word, 0x01a6)
  if (!fcClx || !lcbClx || fcClx + lcbClx > table.length || lcbClx > 64 * 1024 * 1024) {
    return ''
  }

  let pos = fcClx
  const end = fcClx + lcbClx
  while (pos < end) {
    const marker = table[pos]
    if (marker === 0x01) {
      // Prc：跳过一段属性数据
      const size = readU16(table, pos + 1)
      pos += 3 + size
      continue
    }
    if (marker !== 0x02) {
      pos += 1
      continue
    }
    const lcb = readU32(table, pos + 1)
    const plcStart = pos + 5
    const plcEnd = plcStart + lcb
    if (lcb < 4 || plcEnd > table.length) {
      return ''
    }
    const pieceCount = Math.floor((lcb - 4) / 12)
    if (pieceCount <= 0) {
      return ''
    }
    const cpStart = plcStart
    const pcdStart = cpStart + (pieceCount + 1) * 4
    let output = ''
    for (let index = 0; index < pieceCount; index += 1) {
      const cpFrom = readU32(table, cpStart + index * 4)
      const cpTo = readU32(table, cpStart + (index + 1) * 4)
      const characterCount = cpTo - cpFrom
      if (characterCount <= 0) {
        continue
      }
      const pcd = pcdStart + index * 8
      const rawFc = readU32(table, pcd + 2)
      const compressed = (rawFc & 0x40000000) !== 0
      let fc = rawFc & 0x3fffffff
      if (compressed) {
        fc = Math.floor(fc / 2)
      }
      const byteLength = compressed ? characterCount : characterCount * 2
      if (fc < 0 || fc + byteLength > word.length) {
        continue
      }
      const bytes = word.subarray(fc, fc + byteLength)
      output += compressed
        ? new TextDecoder('windows-1252').decode(bytes)
        : new TextDecoder('utf-16le').decode(bytes)
    }
    return cleanWordText(output)
  }
  return ''
}

const extractLegacyDocText = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 8))

  // 很多“.doc”其实是 RTF 或 HTML，先做轻量兜底。
  if (head.startsWith('{\\rtf')) {
    const raw = new TextDecoder('latin1').decode(bytes)
    return raw
      .replace(/\\'([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\[a-z]+-?\d* ?/gi, '')
      .replace(/[{}]/g, '')
      .replace(/\r?\n/g, '\n')
  }
  if (/^<(!doctype|html|head|body)/i.test(head)) {
    const html = new TextDecoder('utf-8').decode(bytes)
    if (typeof DOMParser !== 'undefined') {
      return new DOMParser().parseFromString(html, 'text/html').body?.textContent ?? ''
    }
  }

  try {
    const container = CFB.read(bytes, { type: 'array' })
    const wordEntry = CFB.find(container, 'WordDocument')
    if (!wordEntry?.content) {
      return ''
    }
    const word = new Uint8Array(wordEntry.content)
    const flags = readU16(word, 0x0a)
    const tableName = (flags & 0x0200) !== 0 ? '1Table' : '0Table'
    const tableEntry = CFB.find(container, tableName) ?? CFB.find(container, '0Table')
    if (!tableEntry?.content) {
      return ''
    }
    return decodeWordPieces(word, new Uint8Array(tableEntry.content))
  } catch {
    return ''
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export const extractDocumentText = async (
  blob: Blob,
  name: string
): Promise<ExtractedDocument | null> => {
  const ext = getFileExtension(name)
  let raw = ''
  let kind: DocumentKind
  if (ext === 'pdf') {
    kind = 'pdf'
    raw = await extractPdfText(blob)
  } else if (ext === 'docx') {
    kind = 'docx'
    raw = await extractDocxText(blob)
  } else if (ext === 'doc') {
    kind = 'doc'
    raw = await extractLegacyDocText(blob)
  } else {
    kind = 'text'
    const sliced = blob.size > MAX_TEXT_BYTES ? blob.slice(0, MAX_TEXT_BYTES) : blob
    raw = await sliced.text()
  }
  const { text, truncated } = truncate(raw)
  return text ? { kind, text, truncated } : null
}
