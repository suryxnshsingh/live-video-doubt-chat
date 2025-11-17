import fs from 'fs'
import path from 'path'

interface ChatLogEntry {
  timestamp: string
  studentName: string
  userQuery: string
  transcriptContext: string
  isGenuine: boolean
  category: string
  confidence: number
  reason: string
  response: string | null
  language: string
}

const CSV_FILE_PATH = path.join(process.cwd(), 'data', 'chat_logs.csv')

// Ensure data directory exists
function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

// Ensure CSV file exists with headers
function ensureCsvExists() {
  ensureDataDirectory()

  if (!fs.existsSync(CSV_FILE_PATH)) {
    const headers = [
      'Timestamp',
      'Student Name',
      'User Query',
      'Transcript Context',
      'Is Genuine',
      'Category',
      'Confidence',
      'Reason',
      'Response',
      'Language'
    ].join(',')

    fs.writeFileSync(CSV_FILE_PATH, headers + '\n', 'utf-8')
    console.log('Created new CSV log file:', CSV_FILE_PATH)
  }
}

// Escape CSV field (handle commas, quotes, newlines)
function escapeCsvField(field: string | number | boolean | null): string {
  if (field === null || field === undefined) {
    return '""'
  }

  const stringField = String(field)

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`
  }

  return `"${stringField}"`
}

// Log a chat interaction to CSV
export async function logChatInteraction(entry: ChatLogEntry): Promise<void> {
  try {
    ensureCsvExists()

    const row = [
      entry.timestamp,
      entry.studentName,
      entry.userQuery,
      entry.transcriptContext,
      entry.isGenuine,
      entry.category,
      entry.confidence,
      entry.reason,
      entry.response,
      entry.language
    ].map(escapeCsvField).join(',')

    fs.appendFileSync(CSV_FILE_PATH, row + '\n', 'utf-8')
    console.log('Logged chat interaction to CSV')
  } catch (error) {
    console.error('Error logging to CSV:', error)
    // Don't throw - logging shouldn't break the API
  }
}

// Get CSV file path (useful for downloading/viewing)
export function getCsvFilePath(): string {
  return CSV_FILE_PATH
}
