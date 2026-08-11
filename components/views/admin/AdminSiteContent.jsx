'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { toast } from 'sonner'
import { Save, Eye, Loader2, Globe, FileText, Phone, LayoutTemplate, Upload, Plus, Trash2, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ─── File Uploader Component ───────────────────────────────────────────────
function FileUploader({ accept, onUploaded, label }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef(null)

  const upload = async (files) => {
    setUploading(true)
    setProgress(10)
    const results = []
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData()
      fd.append('file', files[i])
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: fd,
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        if (!res.ok) throw new Error('Upload failed')
        const data = await res.json()
        results.push(data)
        setProgress(Math.round(((i + 1) / files.length) * 100))
      } catch (e) {
        toast.error(`Upload failed: ${files[i].name}`)
      }
    }
    setUploading(false)
    if (results.length) {
      toast.success(`Uploaded ${results.length} file(s)`)
      onUploaded(results.map(r => r.url))
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => {
          const files = Array.from(e.target.files || [])
          if (files.length) upload(files)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full border-2 border-dashed border-border rounded-xl p-4 hover:border-accent hover:bg-accent/5 transition text-center group flex flex-col items-center justify-center cursor-pointer"
      >
        {uploading ? (
          <div>
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent mb-1" />
            <p className="text-xs font-semibold">Uploading... {progress}%</p>
          </div>
        ) : (
          <div>
            <Upload className="w-5 h-5 mx-auto mb-1 text-muted-foreground group-hover:text-accent transition" />
            <p className="text-xs font-semibold">{label}</p>
          </div>
        )}
      </button>
    </div>
  )
}

const PAGES = [
  { id: 'homepage', label: 'Homepage', icon: Globe },
  { id: 'about', label: 'About', icon: FileText },
  { id: 'store', label: 'Store Page', icon: LayoutTemplate },
  { id: 'contact', label: 'Contact', icon: Phone }
]

// ─── TipTap Editor Wrapper ──────────────────────────────────────────────────
function RichTextEditor({ value, onChange, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder || 'Write here...' })
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[120px] p-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/30'
      }
    }
  })

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false)
    }
  }, [value])

  if (!editor) return <div className="h-32 skeleton rounded-xl" />

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex flex-wrap gap-1 p-2 bg-muted/50 border-b">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={`px-2 py-1 rounded text-xs font-bold ${editor.isActive('bold') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/10'}`}>B</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-2 py-1 rounded text-xs italic ${editor.isActive('italic') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/10'}`}>I</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 py-1 rounded text-xs font-bold ${editor.isActive('heading', { level: 2 }) ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/10'}`}>H2</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`px-2 py-1 rounded text-xs font-bold ${editor.isActive('heading', { level: 3 }) ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/10'}`}>H3</button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-2 py-1 rounded text-xs ${editor.isActive('bulletList') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/10'}`}>• List</button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`px-2 py-1 rounded text-xs ${editor.isActive('orderedList') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/10'}`}>1. List</button>
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`px-2 py-1 rounded text-xs ${editor.isActive('blockquote') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/10'}`}>" Quote</button>
        <button onClick={() => {
          const url = window.prompt('URL:')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }} className={`px-2 py-1 rounded text-xs ${editor.isActive('link') ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/10'}`}>🔗 Link</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function AdminSiteContent() {
  const [activePage, setActivePage] = useState('homepage')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [content, setContent] = useState({})

  // Fetch all site content
  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/admin/site-content', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const rows = await res.json()
          const map = {}
          for (const row of rows) {
            if (!map[row.page]) map[row.page] = {}
            map[row.page][row.section] = { value: row.content_value, type: row.content_type }
          }
          setContent(map)
        }
      } catch (e) {
        console.error('Failed to load site content:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const updateField = useCallback((page, section, value, contentType = 'text') => {
    setContent(prev => ({
      ...prev,
      [page]: {
        ...prev[page],
        [section]: { value, type: contentType }
      }
    }))
  }, [])

  const getVal = (page, section, fallback = '') => content[page]?.[section]?.value || fallback

  const handleSave = async () => {
    setSaving(true)
    try {
      const rows = []
      for (const [page, sections] of Object.entries(content)) {
        for (const [section, { value, type }] of Object.entries(sections)) {
          rows.push({ page, section, content_type: type, content_value: value })
        }
      }
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/site-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rows })
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Site content saved — changes are live!')
    } catch (e) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="space-y-4">{Array(3).fill(0).map((_, i) => <div key={i} className="h-32 skeleton rounded-xl" />)}</div>

  return (
    <div className="max-w-4xl slide-up space-y-6 text-left">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Website Content</h1>
          <p className="text-sm text-muted-foreground mt-1">Edit the public-facing content of your website — changes go live instantly.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)} className="rounded-full text-xs font-bold">
            <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-full text-xs font-bold gold-gradient text-primary">
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5 mr-1.5" /> Save All</>}
          </Button>
        </div>
      </div>

      {/* Page Tabs */}
      <div className="flex gap-2 border-b border-border/60 pb-2">
        {PAGES.map(p => {
          const Icon = p.icon
          return (
            <button key={p.id} onClick={() => setActivePage(p.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${activePage === p.id ? 'gold-gradient text-primary shadow-soft' : 'text-muted-foreground hover:bg-accent/10'}`}>
              <Icon className="w-4 h-4" /> {p.label}
            </button>
          )
        })}
      </div>

      {/* Homepage Tab */}
      {activePage === 'homepage' && (
        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-6">
          <h3 className="font-display font-extrabold text-lg">Hero Section</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Badge Text</Label><Input value={getVal('homepage', 'hero_badge', 'Est. 2020 — Pune, India')} onChange={e => updateField('homepage', 'hero_badge', e.target.value)} className="h-10 rounded-xl" /></div>
            <div>
              <Label>Hero Background Image</Label>
              {getVal('homepage', 'hero_image') ? (
                <div className="mt-2 relative w-full h-32 border rounded-xl overflow-hidden bg-secondary flex items-center justify-center p-2">
                  <img src={getVal('homepage', 'hero_image')} alt="Hero Background" className="max-w-full max-h-full object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => updateField('homepage', 'hero_image', '', 'image')}
                    className="absolute top-1.5 right-1.5 bg-destructive/90 text-white rounded-full p-1.5 hover:bg-destructive transition shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 rotate-45" />
                  </button>
                </div>
              ) : (
                <div className="mt-2">
                  <FileUploader
                    accept="image/*"
                    label="Upload Hero Background Image"
                    onUploaded={urls => updateField('homepage', 'hero_image', urls[0], 'image')}
                  />
                </div>
              )}
            </div>
            <div><Label>Hero Title (Line 1)</Label><Input value={getVal('homepage', 'hero_title', 'Your Trusted')} onChange={e => updateField('homepage', 'hero_title', e.target.value)} className="h-10 rounded-xl" /></div>
            <div><Label>Hero Title (Line 2 — Accent)</Label><Input value={getVal('homepage', 'hero_title_accent', 'B2B Partner')} onChange={e => updateField('homepage', 'hero_title_accent', e.target.value)} className="h-10 rounded-xl" /></div>
          </div>
          <div><Label>Hero Subtitle</Label><Input value={getVal('homepage', 'hero_subtitle', 'Office Stationery · Housekeeping · UPS Solutions')} onChange={e => updateField('homepage', 'hero_subtitle', e.target.value)} className="h-10 rounded-xl" /></div>

          <h3 className="font-display font-extrabold text-lg pt-4 border-t">Featured CTA Banner</h3>
          <div><Label>Banner Title</Label><Input value={getVal('homepage', 'featured_banner_title', 'Bulk orders? Custom quotes in 2 hours.')} onChange={e => updateField('homepage', 'featured_banner_title', e.target.value)} className="h-10 rounded-xl" /></div>
          <div><Label>Banner Text</Label><Textarea value={getVal('homepage', 'featured_banner_text', 'Corporate purchase for 100+ units? WhatsApp us or use our contact form.')} onChange={e => updateField('homepage', 'featured_banner_text', e.target.value)} rows={2} className="rounded-xl" /></div>

          <h3 className="font-display font-extrabold text-lg pt-4 border-t">Promotional Marquee Strip</h3>
          <div><Label>Marquee Text</Label><Input value={getVal('homepage', 'promo_strip', 'Free Pan-India Delivery on Bulk Orders')} onChange={e => updateField('homepage', 'promo_strip', e.target.value)} className="h-10 rounded-xl" /></div>

          <h3 className="font-display font-extrabold text-lg pt-4 border-t">Feature Highlights Strip (4 cards)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-secondary/20 rounded-xl border space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Highlight 1</span>
              <div><Label>Title</Label><Input value={getVal('homepage', 'highlight_1_title', 'Pan India Delivery')} onChange={e => updateField('homepage', 'highlight_1_title', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
              <div><Label>Subtitle</Label><Input value={getVal('homepage', 'highlight_1_desc', 'Same-day dispatch across Maharashtra')} onChange={e => updateField('homepage', 'highlight_1_desc', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
            </div>
            <div className="p-3 bg-secondary/20 rounded-xl border space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Highlight 2</span>
              <div><Label>Title</Label><Input value={getVal('homepage', 'highlight_2_title', 'Premium Quality')} onChange={e => updateField('homepage', 'highlight_2_title', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
              <div><Label>Subtitle</Label><Input value={getVal('homepage', 'highlight_2_desc', 'Only verified & trusted brands')} onChange={e => updateField('homepage', 'highlight_2_desc', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
            </div>
            <div className="p-3 bg-secondary/20 rounded-xl border space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Highlight 3</span>
              <div><Label>Title</Label><Input value={getVal('homepage', 'highlight_3_title', 'GST Invoice')} onChange={e => updateField('homepage', 'highlight_3_title', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
              <div><Label>Subtitle</Label><Input value={getVal('homepage', 'highlight_3_desc', '100% B2B tax compliance on every order')} onChange={e => updateField('homepage', 'highlight_3_desc', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
            </div>
            <div className="p-3 bg-secondary/20 rounded-xl border space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Highlight 4</span>
              <div><Label>Title</Label><Input value={getVal('homepage', 'highlight_4_title', '2 Hour Quotes')} onChange={e => updateField('homepage', 'highlight_4_title', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
              <div><Label>Subtitle</Label><Input value={getVal('homepage', 'highlight_4_desc', 'Rapid response for bulk & corporate orders')} onChange={e => updateField('homepage', 'highlight_4_desc', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
            </div>
          </div>

          <h3 className="font-display font-extrabold text-lg pt-4 border-t">Why Choose Us (6 value cards)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-secondary/20 rounded-xl border space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground font-mono">Card 1 (Quality)</span>
              <div><Label>Title</Label><Input value={getVal('homepage', 'why_1_title', 'Premium Quality')} onChange={e => updateField('homepage', 'why_1_title', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
              <div><Label>Description</Label><Textarea value={getVal('homepage', 'why_1_desc', 'Only trusted brands & genuine products — verified by our procurement team.')} onChange={e => updateField('homepage', 'why_1_desc', e.target.value)} rows={2} className="text-xs rounded-xl" /></div>
            </div>
            <div className="p-3 bg-secondary/20 rounded-xl border space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground font-mono">Card 2 (Pricing)</span>
              <div><Label>Title</Label><Input value={getVal('homepage', 'why_2_title', 'Wholesale Pricing')} onChange={e => updateField('homepage', 'why_2_title', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
              <div><Label>Description</Label><Textarea value={getVal('homepage', 'why_2_desc', 'Best B2B rates with custom corporate rate cards & volume-based discounts.')} onChange={e => updateField('homepage', 'why_2_desc', e.target.value)} rows={2} className="text-xs rounded-xl" /></div>
            </div>
            <div className="p-3 bg-secondary/20 rounded-xl border space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground font-mono">Card 3 (Logistics)</span>
              <div><Label>Title</Label><Input value={getVal('homepage', 'why_3_title', 'Timely Delivery')} onChange={e => updateField('homepage', 'why_3_title', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
              <div><Label>Description</Label><Textarea value={getVal('homepage', 'why_3_desc', 'Same-day dispatch in Maharashtra, next-day pan-India logistics network.')} onChange={e => updateField('homepage', 'why_3_desc', e.target.value)} rows={2} className="text-xs rounded-xl" /></div>
            </div>
            <div className="p-3 bg-secondary/20 rounded-xl border space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground font-mono">Card 4 (Support)</span>
              <div><Label>Title</Label><Input value={getVal('homepage', 'why_4_title', 'Dedicated Support')} onChange={e => updateField('homepage', 'why_4_title', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
              <div><Label>Description</Label><Textarea value={getVal('homepage', 'why_4_desc', 'Personal account manager assigned to every corporate & bulk buyer.')} onChange={e => updateField('homepage', 'why_4_desc', e.target.value)} rows={2} className="text-xs rounded-xl" /></div>
            </div>
            <div className="p-3 bg-secondary/20 rounded-xl border space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground font-mono">Card 5 (Experience)</span>
              <div><Label>Title / Metric</Label><Input value={getVal('homepage', 'stats_b2b_years', '5+ Years B2B')} onChange={e => updateField('homepage', 'stats_b2b_years', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
              <div><Label>Description</Label><Textarea value={getVal('homepage', 'stats_b2b_desc', 'Trusted partner for finance, insurance, IT & manufacturing since 2020.')} onChange={e => updateField('homepage', 'stats_b2b_desc', e.target.value)} rows={2} className="text-xs rounded-xl" /></div>
            </div>
            <div className="p-3 bg-secondary/20 rounded-xl border space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground font-mono">Card 6 (Products)</span>
              <div><Label>Title / Metric</Label><Input value={getVal('homepage', 'stats_products_count', '300+ Products')} onChange={e => updateField('homepage', 'stats_products_count', e.target.value)} className="h-9 text-xs rounded-xl" /></div>
              <div><Label>Description</Label><Textarea value={getVal('homepage', 'stats_products_desc', 'Wide catalog spanning office stationery, housekeeping & UPS solutions.')} onChange={e => updateField('homepage', 'stats_products_desc', e.target.value)} rows={2} className="text-xs rounded-xl" /></div>
            </div>
          </div>
        </CardContent></Card>
      )}

      {/* About Tab */}
      {activePage === 'about' && (
        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-5">
          <h3 className="font-display font-extrabold text-lg">About Story</h3>
          <RichTextEditor value={getVal('about', 'about_body', '<p>Your trusted partner for office stationery, housekeeping solutions & UPS supply. Established in 2020, serving businesses pan-India from Pune.</p>')} onChange={v => updateField('about', 'about_body', v, 'richtext')} placeholder="Write about your company..." />
          
          <h3 className="font-display font-extrabold text-lg pt-4 border-t">Our Mission & Vision</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Mission</Label><RichTextEditor value={getVal('about', 'mission', '<p>To provide high-quality products and dependable services that help businesses maintain efficient, clean, and productive workplaces.</p>')} onChange={v => updateField('about', 'mission', v, 'richtext')} placeholder="Describe your mission..." /></div>
            <div><Label>Vision</Label><RichTextEditor value={getVal('about', 'vision', "<p>To become one of India's most trusted suppliers of office essentials and facility support products.</p>")} onChange={v => updateField('about', 'vision', v, 'richtext')} placeholder="Describe your vision..." /></div>
          </div>
          
          <h3 className="font-display font-extrabold text-lg pt-4 border-t">Company Stats (KPI Cards)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Company Info Section Title</Label><Input value={getVal('about', 'company_info_title', 'Company Info')} onChange={e => updateField('about', 'company_info_title', e.target.value)} className="h-10 rounded-xl" /></div>
            <div><Label>Established Year</Label><Input value={getVal('about', 'established_year', '2020')} onChange={e => updateField('about', 'established_year', e.target.value)} className="h-10 rounded-xl" /></div>
            <div><Label>Team Members count</Label><Input value={getVal('about', 'team_members_count', '7+')} onChange={e => updateField('about', 'team_members_count', e.target.value)} className="h-10 rounded-xl" /></div>
            <div><Label>Happy Clients count</Label><Input value={getVal('about', 'happy_clients_count', '500+')} onChange={e => updateField('about', 'happy_clients_count', e.target.value)} className="h-10 rounded-xl" /></div>
          </div>
        </CardContent></Card>
      )}

      {/* Store Page Tab */}
      {activePage === 'store' && (
        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-5">
          <h3 className="font-display font-extrabold text-lg">Store Page Header CMS (Logged-In View)</h3>
          <div className="space-y-4">
            <div>
              <Label>Store Promo Title (Catalog header)</Label>
              <Input
                value={getVal('store', 'title', 'Premium Corporate Supplies at Wholesale Prices')}
                onChange={e => updateField('store', 'title', e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <Label>Store Subtitle</Label>
              <Input
                value={getVal('store', 'subtitle', 'Browse our extensive catalog of quality office products.')}
                onChange={e => updateField('store', 'subtitle', e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
          </div>

          <h3 className="font-display font-extrabold text-lg pt-4 border-t">Public Showcase CMS (Logged-Out View)</h3>
          <div className="space-y-4">
            <div>
              <Label>Showcase Page Title</Label>
              <Input
                value={getVal('store', 'logged_out_title', 'AK Enterprises Product Portfolio')}
                onChange={e => updateField('store', 'logged_out_title', e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <Label>Showcase Page Subtitle</Label>
              <Textarea
                value={getVal('store', 'logged_out_subtitle', 'AK Enterprises is a private B2B supplier. Browse a selection of our products below. To view full catalog with SKUs, inventory, and customer-specific wholesale pricing, please log into your corporate portal.')}
                onChange={e => updateField('store', 'logged_out_subtitle', e.target.value)}
                rows={3}
                className="rounded-xl"
              />
            </div>
            <div>
              <Label>Showcase Banner Image</Label>
              {getVal('store', 'showcase_banner') ? (
                <div className="mt-2 relative w-full h-32 border rounded-xl overflow-hidden bg-secondary flex items-center justify-center p-2">
                  <img src={getVal('store', 'showcase_banner')} alt="Showcase Banner" className="max-w-full max-h-full object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => updateField('store', 'showcase_banner', '')}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="mt-2">
                  <FileUploader
                    accept="image/*"
                    onUploaded={urls => updateField('store', 'showcase_banner', urls[0])}
                    label="Upload Showcase Banner Image"
                  />
                </div>
              )}
            </div>
          </div>

          <h3 className="font-display font-extrabold text-lg pt-4 border-t">View Complete B2B Catalog CTA</h3>
          <div className="space-y-4">
            <div>
              <Label>CTA Title</Label>
              <Input
                value={getVal('store', 'cta_title', 'View Complete B2B Catalog')}
                onChange={e => updateField('store', 'cta_title', e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <Label>CTA Subtitle</Label>
              <Textarea
                value={getVal('store', 'cta_subtitle', 'Log in to access the full product catalog with real-time inventory, customer-specific pricing, and place orders directly.')}
                onChange={e => updateField('store', 'cta_subtitle', e.target.value)}
                rows={2}
                className="rounded-xl"
              />
            </div>
          </div>
        </CardContent></Card>
      )}

      {/* Contact Tab */}
      {activePage === 'contact' && (
        <Card className="radius-lg shadow-soft"><CardContent className="pt-6 space-y-4">
          <h3 className="font-display font-extrabold text-lg">Contact Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Phone</Label><Input value={getVal('contact', 'phone', '+91 83088 60894')} onChange={e => updateField('contact', 'phone', e.target.value)} className="h-10 rounded-xl" /></div>
            <div><Label>Email</Label><Input value={getVal('contact', 'email', 'akenterprises1411@gmail.com')} onChange={e => updateField('contact', 'email', e.target.value)} className="h-10 rounded-xl" /></div>
            <div><Label>Contact Person</Label><Input value={getVal('contact', 'contact_person', 'Mr. Sagar Lahole')} onChange={e => updateField('contact', 'contact_person', e.target.value)} className="h-10 rounded-xl" /></div>
            <div><Label>Business Hours</Label><Input value={getVal('contact', 'business_hours', 'Mon–Sat: 9:30 AM – 7:00 PM')} onChange={e => updateField('contact', 'business_hours', e.target.value)} className="h-10 rounded-xl" placeholder="e.g. Mon–Sat: 9:30 AM – 7:00 PM" /></div>
          </div>
          <div><Label>Address</Label><Textarea value={getVal('contact', 'address', 'Pune, Maharashtra')} onChange={e => updateField('contact', 'address', e.target.value)} rows={2} className="rounded-xl" /></div>
          <div><Label>Custom Text (shown below contact cards)</Label><Textarea value={getVal('contact', 'custom_text')} onChange={e => updateField('contact', 'custom_text', e.target.value)} rows={2} className="rounded-xl" placeholder="Any additional information for visitors..." /></div>
        </CardContent></Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white p-6 rounded-2xl border">
          <DialogHeader>
            <DialogTitle className="text-slate-800 font-extrabold text-lg">Preview — {PAGES.find(p => p.id === activePage)?.label}</DialogTitle>
          </DialogHeader>
          <div className="rounded-xl border bg-slate-50 p-6 text-sm text-slate-800 space-y-4">
            {activePage === 'homepage' && (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-bold text-amber-700">
                  <LayoutTemplate className="w-3 h-3" /> {getVal('homepage', 'hero_badge', 'Est. 2020')}
                </div>
                <h2 className="text-4xl font-extrabold text-slate-900 leading-tight">
                  {getVal('homepage', 'hero_title', 'Your Trusted')}<br />
                  <span className="text-amber-600">{getVal('homepage', 'hero_title_accent', 'B2B Partner')}</span>
                </h2>
                <p className="text-lg text-slate-600 font-light">{getVal('homepage', 'hero_subtitle')}</p>
                {getVal('homepage', 'hero_image') && (
                  <div className="w-full h-40 rounded-xl overflow-hidden border">
                    <img src={getVal('homepage', 'hero_image')} alt="Hero BG" className="w-full h-full object-cover" />
                  </div>
                )}
                
                <div className="pt-4 border-t">
                  <h4 className="font-extrabold text-xs text-slate-400 uppercase mb-2">Highlights</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 border rounded bg-white"><strong>{getVal('homepage', 'highlight_1_title', 'Pan India Delivery')}</strong>: {getVal('homepage', 'highlight_1_desc', 'Same-day dispatch')}</div>
                    <div className="p-2 border rounded bg-white"><strong>{getVal('homepage', 'highlight_2_title', 'Premium Quality')}</strong>: {getVal('homepage', 'highlight_2_desc', 'Only verified brands')}</div>
                    <div className="p-2 border rounded bg-white"><strong>{getVal('homepage', 'highlight_3_title', 'GST Invoice')}</strong>: {getVal('homepage', 'highlight_3_desc', '100% compliance')}</div>
                    <div className="p-2 border rounded bg-white"><strong>{getVal('homepage', 'highlight_4_title', '2 Hour Quotes')}</strong>: {getVal('homepage', 'highlight_4_desc', 'Rapid response')}</div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-extrabold text-xs text-slate-400 uppercase mb-2">Why Choose Us (First 2 Cards)</h4>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 border rounded bg-white"><strong>{getVal('homepage', 'why_1_title', 'Premium Quality')}</strong>: {getVal('homepage', 'why_1_desc')}</div>
                    <div className="p-2 border rounded bg-white"><strong>{getVal('homepage', 'why_2_title', 'Wholesale Pricing')}</strong>: {getVal('homepage', 'why_2_desc')}</div>
                  </div>
                </div>
              </div>
            )}
            {activePage === 'about' && (
              <div className="space-y-6">
                <div><h3 className="font-bold text-lg mb-2 text-slate-800">Mission</h3><div className="prose text-xs" dangerouslySetInnerHTML={{ __html: getVal('about', 'mission', '<p>Mission content...</p>') }} /></div>
                <div><h3 className="font-bold text-lg mb-2 text-slate-800">Vision</h3><div className="prose text-xs" dangerouslySetInnerHTML={{ __html: getVal('about', 'vision', '<p>Vision content...</p>') }} /></div>
                <div><h3 className="font-bold text-lg mb-2 text-slate-800">About Story</h3><div className="prose text-xs" dangerouslySetInnerHTML={{ __html: getVal('about', 'about_body', '<p>About story...</p>') }} /></div>
              </div>
            )}
            {activePage === 'store' && (
              <div className="space-y-4">
                <h2 className="text-3xl font-extrabold text-slate-900 leading-tight">
                  {getVal('store', 'title', 'Premium Corporate Supplies at Wholesale Prices')}
                </h2>
                <p className="text-slate-600">{getVal('store', 'subtitle', 'Browse our extensive catalog of quality office products.')}</p>
              </div>
            )}
            {activePage === 'contact' && (
              <div className="space-y-3">
                <p><strong>Phone:</strong> {getVal('contact', 'phone')}</p>
                <p><strong>Email:</strong> {getVal('contact', 'email')}</p>
                <p><strong>Contact Person:</strong> {getVal('contact', 'contact_person')}</p>
                <p><strong>Business Hours:</strong> {getVal('contact', 'business_hours')}</p>
                <p><strong>Address:</strong> {getVal('contact', 'address')}</p>
                {getVal('contact', 'custom_text') && <p className="mt-4 text-slate-500 italic">{getVal('contact', 'custom_text')}</p>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
