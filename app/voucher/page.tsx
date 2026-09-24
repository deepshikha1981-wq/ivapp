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
      setLines([
        { ledger: '', type: 'debit', amount: '' },
        { ledger: '', type: 'credit', amount: '' }
      ])
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 700 }}>
      <h1>Voucher Builder</h1>

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
