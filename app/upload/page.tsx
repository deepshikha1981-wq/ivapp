'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [files, setFiles] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractedData, setExtractedData] = useState<string>('')

  const fetchFiles = async () => {
    const { data } = await supabase.storage.from('invoices').list()
    if (data) {
      setFiles(data.map((f) => f.name))
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setExtractedData('')

    const cleanName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.]/g, '_')
    const { error } = await supabase.storage.from('invoices').upload(cleanName, file)
    setUploading(false)

    if (error) {
      alert('Upload failed: ' + error.message)
      return
    }

    fetchFiles()

    const publicUrlData = supabase.storage.from('invoices').getPublicUrl(cleanName)
    const fileUrl = publicUrlData.data.publicUrl

    setExtracting(true)
    const extractRes = await fetch('/api/extract-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl })
    })
    const extractResult = await extractRes.json()
    setExtracting(false)

    if (extractResult.error) {
      setExtractedData('Extraction error: ' + extractResult.error)
    } else {
      setExtractedData(extractResult.raw)
    }
  }

  const handleDelete = async (fileName: string) => {
    const confirmed = confirm('Delete this invoice? This cannot be undone.')
    if (!confirmed) return

    const { error } = await supabase.storage.from('invoices').remove([fileName])
    if (error) {
      alert('Delete failed: ' + error.message)
    } else {
      fetchFiles()
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Invoice Upload Test</h1>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
      />
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>

      {extracting && <p>Reading invoice with AI...</p>}

      {extractedData && (
        <div style={{ marginTop: 20, padding: 15, background: '#f0f0f0' }}>
          <h3>Extracted Data:</h3>
          <pre>{extractedData}</pre>
        </div>
      )}

      <h2>Uploaded Files</h2>
      <ul>
        {files.map((name) => (
          <li key={name}>
            {name}{' '}
            <button onClick={() => handleDelete(name)} style={{ marginLeft: 10 }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
