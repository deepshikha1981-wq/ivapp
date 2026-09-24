'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

type Line = {
  ledger: string
  type: 'debit' | 'credit'
  amount: string
}

export default function VoucherPage() {
  const [ledgers, setLedgers] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const [voucherNumber, setVoucherNumber] = useState('')
  const [voucherDate, setVoucherDate] = useState('')
  const [narration, setNarration] = useState('')
  const [lines, setLines] = useState<Line[]>([
    { ledger: '', type: 'debit', amount: '' },
    { ledger: '', type: 'credit', amount: '' }
  ])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchLedgers = async () => {
      const { data } = await supabase.from('ledgers').select('name')
      if (data) {
        setLedgers(data.map((l) => l.name))
      }
    }
    fetchLedgers()
  }, [])

  const handleUploadAndExtract = async () => {
    if (!file) return
    setUploading(true)

    const cleanName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.]/g, '_')
    const { error } = await supabase.storage.from('invoices').upload(cleanName, file)
    setUploading(false)

    if (error) {
      alert('Upload failed: ' + error.message)
      return
    }

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
      alert('Extraction error: ' + extractResult.error)
      return
    }

    let cleanedText = extractResult.raw.trim()
    cleanedText = cleanedText.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim()

    try {
      const parsed = JSON.parse(cleanedText)

      setNarration(
        (parsed.vendor_name || 'Unknown vendor') +
        ' - Invoice ' + (parsed.invoice_number || '') +
        (parsed.invoice_date ? ' dated ' + parsed.invoice_date : '')
      )

      const amount = parsed.total_amount || parsed.taxable_amount || ''

      setLines([
        { ledger: '', type: 'debit', amount: String(amount) },
        { ledger: '', type: 'credit', amount: String(amount) }
      ])

      if (parsed.invoice_number) {
        setVoucherNumber(parsed.invoice_number)
      }
      if (parsed.invoice_date) {
        setVoucherDate(parsed.invoice_date)
      }
    } catch (e) {
      alert('AI extraction did not return clean data. Raw response: ' + cleanedText)
    }
  }

  const updateLine = (index: number, field: keyof Line, value: string) => {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setLines(newLines)
  }

  const toggleType = (index: number) => {
    const newLines = [...lines]
    newLines[index].type = newLines[index].type === 'debit' ? 'credit' : 'debit'
    setLines(newLines)
  }

  const addLine = () => {
    setLines([...lines, { ledger: '', type: 'debit', amount: '' }])
  }

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index))
  }

  const totalDebit = lines
    .filter((l) => l.type === 'debit')
    .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0)

  const totalCredit = lines
    .filter((l) => l.type === 'credit')
    .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0)

  const isBalanced = totalDebit === totalCredit && totalDebit > 0

  const handleSave = async () => {
    if (!isBalanced) {
      alert('Debit and Credit totals must match before saving.')
      return
    }
    if (lines.some((l) => !l.ledger)) {
      alert('Please select a ledger for every line.')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('vouchers').insert({
      voucher_number: voucherNumber,
      voucher_date: voucherDate || null,
      narration: narration,
      lines: lines
    })
    setSaving(false)

    if (error) {
      alert('Save failed: ' + error.message)
    } else {
      alert('Voucher saved successfully!')
      setVoucherNumber('')
      setNarration('')
      setFile(null)
      setLines([
        { ledger: '', type: 'debit', amount: '' },
        { ledger: '', type: 'credit', amount: '' }
      ])
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 700 }}>
      <h1>Invoice to Voucher</h1>

      <div style={{ padding: 15, background: '#f0f0f0', marginBottom: 25 }}>
        <h3>Step 1: Upload Invoice</h3>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
        />
        <button onClick={handleUploadAndExtract} disabled={uploading || extracting}>
          {uploading ? 'Uploading...' : extracting ? 'Reading with AI...' : 'Upload & Extract'}
        </button>
      </div>

      <h3>Step 2: Review Voucher</h3>

      <div style={{ marginBottom: 15 }}>
        <label>Voucher Number: </label>
        <input value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)} />
      </div>

      <div style={{ marginBottom: 15 }}>
        <label>Date: </label>
        <input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
      </div>

      <h3>Ledger Lines</h3>
      {lines.map((line, index) => (
        <div key={index} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
          <select value={line.ledger} onChange={(e) => updateLine(index, 'ledger', e.target.value)}>
            <option value="">-- Select Ledger --</option>
            {ledgers.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <button onClick={() => toggleType(index)} style={{ background: line.type === 'debit' ? '#cce5ff' : '#ffd6d6' }}>
            {line.type === 'debit' ? 'Dr' : 'Cr'}
          </button>

          <input
            type="number"
            placeholder="Amount"
            value={line.amount}
            onChange={(e) => updateLine(index, 'amount', e.target.value)}
          />

          <button onClick={() => removeLine(index)}>Remove</button>
        </div>
      ))}

      <button onClick={addLine}>+ Add Line</button>

      <div style={{ marginTop: 20 }}>
        <label>Narration: </label>
        <br />
        <textarea
          value={narration}
          onChange={(e) => setNarration(e.target.value)}
          rows={3}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginTop: 15 }}>
        <strong>Total Debit: {totalDebit}</strong> &nbsp;&nbsp;
        <strong>Total Credit: {totalCredit}</strong> &nbsp;&nbsp;
        {isBalanced ? (
          <span style={{ color: 'green' }}>✓ Balanced</span>
        ) : (
          <span style={{ color: 'red' }}>Not balanced</span>
        )}
      </div>

      <button onClick={handleSave} disabled={saving} style={{ marginTop: 15 }}>
        {saving ? 'Saving...' : 'Save Voucher'}
      </button>
    </div>
  )
}
