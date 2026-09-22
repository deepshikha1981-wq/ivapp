'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [files, setFiles] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

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
    const { error } = await supabase.storage.from('invoices').upload(file.name, file)
    setUploading(false)
    if (error) {
      alert('Upload failed: ' + error.message)
    } else {
      alert('Upload successful')
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

      <h2>Uploaded Files</h2>
      <ul>
        {files.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  )
}
