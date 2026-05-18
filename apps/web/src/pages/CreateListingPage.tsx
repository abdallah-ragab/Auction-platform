import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, Check, ChevronRight, Loader2, ImagePlus } from 'lucide-react'
import { createAuction } from '@/api/auctions'
import { apiClient, getErrorMessage } from '@/api/client'
import toast from 'react-hot-toast'
import axios from 'axios'

const CATEGORIES = ['watches', 'cameras', 'art', 'jewellery', 'electronics']
const STEPS = ['Details', 'Pricing', 'Images', 'Review']

type ListingFormData = {
  title: string
  description: string
  category: string
  startingPrice: string
  reservePrice: string
  startsAt: string
  endsAt: string
  imageUrls: string[]
}

const initial: ListingFormData = {
  title: '',
  description: '',
  category: '',
  startingPrice: '',
  reservePrice: '',
  startsAt: '',
  endsAt: '',
  imageUrls: [],
}

export function CreateListingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<ListingFormData>(initial)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [auctionId, setAuctionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewActive, setPreviewActive] = useState(false)

  function set(key: keyof ListingFormData, value: string | string[]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function canNext() {
    if (step === 0) return form.title.length > 3 && form.description.length > 10 && form.category
    if (step === 1) {
      if (!form.startsAt || !form.endsAt) return false
      const start = new Date(form.startsAt).getTime()
      const end = new Date(form.endsAt).getTime()
      const now = Date.now()
      return Number(form.startingPrice) > 0 && start >= now - 60000 && end > start
    }
    return true
  }

  async function handleCreateDraft() {
    setSubmitting(true)
    setError(null)
    try {
      const auction = await createAuction({
        title: form.title,
        description: form.description,
        category: form.category,
        startingPrice: Number(form.startingPrice),
        reservePrice: Number(form.reservePrice) || Number(form.startingPrice),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      })
      setAuctionId(auction.id)
      setStep(2)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !auctionId) return

    if (form.imageUrls.length >= 10) {
      toast.error('Maximum 10 images per auction')
      e.target.value = ''
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Image must be under 20 MB')
      e.target.value = ''
      return
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      toast.error('Only JPG, PNG, WebP or GIF images allowed')
      e.target.value = ''
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('auctionId', auctionId)

      const res = await apiClient.post<{ url: string }>('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      })

      set('imageUrls', [...form.imageUrls, res.data.url])
      toast.success('Image uploaded')
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.code === 'ECONNABORTED') {
          toast.error('Upload timed out — try a smaller image or check your connection')
        } else {
          toast.error(err.response?.data?.message ?? 'Upload failed')
        }
      } else {
        toast.error('Upload failed')
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function removeImage(url: string) {
    set('imageUrls', form.imageUrls.filter((u) => u !== url))
  }

  async function handleFinish() {
    if (!auctionId) return
    toast.success('Listing created!')
    navigate(`/auctions/${auctionId}`)
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <h1 className="font-serif italic text-3xl md:text-5xl text-text-primary mb-8 font-medium">Create Archival Listing</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10 py-3 border-y border-border-base">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{
                  background: i < step ? 'var(--color-primary)' : i === step ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                }}
                className="w-6 h-6 rounded-none flex items-center justify-center text-[10px] font-bold font-mono"
                style={{ color: i <= step ? '#fff' : 'var(--text-tertiary)' }}
              >
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </motion.div>
              <span className={`text-[10px] uppercase font-bold tracking-wider font-sans hidden md:block ${i === step ? 'text-text-primary' : 'text-text-tertiary'}`}>
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px bg-border-base mx-3 animate-pulse" />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="bg-bg-surface rounded-none border border-border-base p-8 shadow-sm">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-none bg-danger-light border border-danger/20 text-xs text-danger font-semibold mb-6"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 0 — Details */}
          {step === 0 && (
            <motion.div
              key="s0"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-primary font-sans">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="e.g. Vintage Rolex Submariner 1968"
                  className="w-full px-4 py-3 rounded-none border border-border-base bg-bg-surface text-xs uppercase tracking-wider text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-all font-sans"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-primary font-sans">Description & Provenance</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Describe the item's condition, historical provenance, and specifications..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-none border border-border-base bg-bg-surface text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-all resize-none font-sans"
                />
              </div>
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-primary font-sans">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => set('category', cat)}
                      className={`px-4 py-2 rounded-none text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                        form.category === cat
                          ? 'bg-primary border-primary text-white'
                          : 'bg-bg-surface border-border-base text-text-secondary hover:border-text-secondary'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 1 — Pricing */}
          {step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-primary font-sans">Starting Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary text-xs font-mono">$</span>
                    <input
                      type="number"
                      value={form.startingPrice}
                      onChange={(e) => set('startingPrice', e.target.value)}
                      placeholder="100"
                      min="1"
                      className="w-full pl-8 pr-4 py-3 rounded-none border border-border-base bg-bg-surface text-xs uppercase tracking-wider text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-all font-sans"
                    />
                  </div>
                  <p className="text-[9px] text-text-tertiary font-sans leading-relaxed">The minimum amount required for the very first bid.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-primary font-sans">
                    Reserve Price <span className="text-text-tertiary font-normal text-[9px] font-mono normal-case">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary text-xs font-mono">$</span>
                    <input
                      type="number"
                      value={form.reservePrice}
                      onChange={(e) => set('reservePrice', e.target.value)}
                      placeholder="500"
                      min="0"
                      className="w-full pl-8 pr-4 py-3 rounded-none border border-border-base bg-bg-surface text-xs uppercase tracking-wider text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-all font-sans"
                    />
                  </div>
                  <p className="text-[9px] text-text-tertiary font-sans leading-relaxed">The hidden minimum threshold. If the final bid does not reach this amount, the item will not be sold.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-primary font-sans">Starts At</label>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => set('startsAt', e.target.value)}
                    className="w-full px-4 py-3 rounded-none border border-border-base bg-bg-surface text-xs text-text-primary focus:outline-none focus:border-primary transition-all font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-primary font-sans">Ends At</label>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => set('endsAt', e.target.value)}
                    className="w-full px-4 py-3 rounded-none border border-border-base bg-bg-surface text-xs text-text-primary focus:outline-none focus:border-primary transition-all font-mono"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2 — Images */}
          {step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <p className="text-[11px] font-sans text-text-secondary uppercase tracking-wider">
                Upload up to 10 images. The first image will be the archival catalog cover.
              </p>

              {/* Upload area */}
              <label className={`flex flex-col items-center justify-center h-44 border border-dashed rounded-none transition-all cursor-pointer ${uploading ? 'border-primary bg-primary/5' : 'border-border-strong bg-bg-tertiary/20 hover:border-primary hover:bg-primary/5'}`}>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-xs uppercase font-bold tracking-widest text-primary">Uploading securely…</p>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-none bg-bg-surface border border-border-base flex items-center justify-center mb-3">
                      <ImagePlus className="w-5 h-5 text-text-tertiary" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-text-primary">Click to upload lot image</p>
                    <p className="text-[9px] font-mono tracking-widest text-text-tertiary uppercase mt-1">PNG, JPG, WebP (Max 20MB)</p>
                  </>
                )}
              </label>

              {/* Image grid */}
              {form.imageUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-3 pt-2">
                  {form.imageUrls.map((url, i) => (
                    <div key={url} className="relative group aspect-square border border-border-base bg-bg-surface">
                      <img src={url} alt="" className="w-full h-full object-cover rounded-none" />
                      {i === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-none bg-black/70 text-white font-mono text-[8px] uppercase tracking-wider">Cover</span>
                      )}
                      <button
                        onClick={() => removeImage(url)}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-none bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/10"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 3 — Review & Preview */}
          {step === 3 && (
            <motion.div
              key="s3"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-border-base pb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-primary font-sans">Verification Panel</span>
                <button
                  type="button"
                  onClick={() => setPreviewActive(!previewActive)}
                  className="px-3 py-1 text-[9px] font-mono font-bold uppercase tracking-widest border border-primary text-primary hover:bg-primary hover:text-white transition-all cursor-pointer rounded-none"
                >
                  {previewActive ? 'Show Specifications' : 'Live Preview Mode'}
                </button>
              </div>

              {previewActive ? (
                /* LIVE PREVIEW SIMULATING AUCTION DETAIL PAGE */
                <div className="border border-border-base bg-bg-surface p-6 space-y-6 rounded-none text-left">
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Simulated image column */}
                    <div className="w-full md:w-1/3 aspect-square bg-bg-tertiary border border-border-base flex items-center justify-center overflow-hidden">
                      {form.imageUrls[0] ? (
                        <img src={form.imageUrls[0]} alt="Lot Preview" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-mono uppercase text-text-tertiary">No Image</span>
                      )}
                    </div>

                    {/* Simulated details column */}
                    <div className="flex-1 space-y-4">
                      <div>
                        <span className="font-mono text-[8px] uppercase tracking-widest text-text-tertiary font-bold">{form.category || 'Category'}</span>
                        <h2 className="font-serif italic text-xl text-text-primary mt-0.5 font-semibold">{form.title || 'Untitled Lot'}</h2>
                      </div>

                      {/* Pricing block */}
                      <div className="bg-bg-tertiary border border-border-base p-4 rounded-none space-y-1">
                        <span className="text-[8px] text-text-tertiary uppercase font-bold tracking-widest">Opening Bid</span>
                        <p className="font-mono text-xl font-bold tracking-tight text-text-primary">
                          ${Number(form.startingPrice || 0).toLocaleString()} USD
                        </p>
                        {form.reservePrice && (
                          <span className="text-[8px] font-mono text-text-tertiary uppercase tracking-wider block">
                            Reserve price set: ${Number(form.reservePrice).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Simulated description */}
                  <div className="pt-4 border-t border-border-base space-y-1.5">
                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-text-primary font-sans">Provenance & Details</h3>
                    <p className="text-xs text-text-secondary leading-relaxed font-light">{form.description || 'No description provided.'}</p>
                  </div>
                </div>
              ) : (
                /* STANDARD SPECIFICATIONS REVIEW LIST */
                <div className="space-y-6">
                  <div className="bg-bg-tertiary/20 p-6 space-y-4 border border-border-base rounded-none font-sans text-xs">
                    {[
                      ['Title', form.title],
                      ['Category', form.category],
                      ['Starting Price', `$${Number(form.startingPrice).toLocaleString()}`],
                      ['Reserve Price', form.reservePrice ? `$${Number(form.reservePrice).toLocaleString()}` : 'None'],
                      ['Images', `${form.imageUrls.length} uploaded`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between items-center border-b border-border-base pb-2 last:border-0 last:pb-0">
                        <span className="text-text-tertiary font-bold uppercase tracking-widest text-[9px] font-sans">{label}</span>
                        <span className="text-text-primary font-bold capitalize tracking-wide">{value}</span>
                      </div>
                    ))}
                  </div>
                  {form.imageUrls[0] && (
                    <div className="relative border border-border-base h-48 bg-bg-surface">
                       <img
                        src={form.imageUrls[0]}
                        alt="Cover"
                        className="w-full h-full object-cover rounded-none"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-8 pt-4 border-t border-border-base">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-5 py-3 rounded-none border border-border-base text-xs font-bold uppercase tracking-widest bg-bg-surface text-text-secondary hover:border-text-secondary transition-all shrink-0 cursor-pointer"
            >
              Back
            </button>
          )}

          {step === 0 && (
            <button
              type="button"
              onClick={() => canNext() && setStep(1)}
              disabled={!canNext()}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-none bg-primary text-white text-xs uppercase tracking-widest font-semibold hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 1 && (
            <button
              type="button"
              onClick={handleCreateDraft}
              disabled={!canNext() || submitting}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-none bg-primary text-white text-xs uppercase tracking-widest font-semibold hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {submitting ? 'Creating Draft…' : 'Continue'}
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-none bg-primary text-white text-xs uppercase tracking-widest font-semibold hover:bg-primary-dark transition-all cursor-pointer"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && (
            <div className="flex-1 flex flex-col items-center">
              <button
                type="button"
                onClick={handleFinish}
                className="w-full flex items-center justify-center gap-1.5 py-3 rounded-none bg-primary text-white text-xs uppercase tracking-widest font-semibold hover:bg-primary-dark transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" /> Publish Archival Listing
              </button>
              <p className="text-[9px] font-mono text-text-tertiary uppercase tracking-widest mt-3">Please double check your details. Preview mode coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
