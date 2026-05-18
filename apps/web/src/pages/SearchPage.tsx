import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useSearch } from '@/hooks/useAuctions'
import { AuctionCard } from '@/components/auction/AuctionCard'

const CATEGORIES = ['All', 'Watches', 'Cameras', 'Art', 'Jewellery', 'Electronics']

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [category, setCategory] = useState('All')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [debouncedMinPrice, setDebouncedMinPrice] = useState('')
  const [debouncedMaxPrice, setDebouncedMaxPrice] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMinPrice(minPrice), 400)
    return () => clearTimeout(timer)
  }, [minPrice])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMaxPrice(maxPrice), 400)
    return () => clearTimeout(timer)
  }, [maxPrice])

  const [showFilters, setShowFilters] = useState(false)
  const [submitted, setSubmitted] = useState(searchParams.get('q') ?? '')

  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    setQuery(q)
    setSubmitted(q)

    const cat = searchParams.get('category') ?? 'All'
    const formattedCat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()
    if (CATEGORIES.includes(formattedCat)) {
      setCategory(formattedCat)
      if (formattedCat !== 'All') {
        setShowFilters(true)
      }
    }
  }, [searchParams])

  const { data, isLoading } = useSearch({
    q: submitted || undefined,
    category: category === 'All' ? undefined : category.toLowerCase(),
    minPrice: debouncedMinPrice ? Number(debouncedMinPrice) : undefined,
    maxPrice: debouncedMaxPrice ? Number(debouncedMaxPrice) : undefined,
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(query)
    const newParams: Record<string, string> = {}
    if (query) newParams.q = query
    if (category !== 'All') newParams.category = category.toLowerCase()
    setSearchParams(newParams)
  }

  const handleCategoryChange = (cat: string) => {
    setCategory(cat)
    const newParams: Record<string, string> = {}
    if (query) newParams.q = query
    if (cat !== 'All') newParams.category = cat.toLowerCase()
    setSearchParams(newParams)
  }

  const results = data?.results ?? []

  return (
    <div className="space-y-10 py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-serif italic text-3xl md:text-5xl text-text-primary mb-6 font-medium">Search Archival Lots</h1>

        {/* Search input */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, description, provenance…"
              className="w-full pl-10 pr-3 py-3 rounded-none border border-border-base bg-bg-surface text-text-primary text-xs uppercase tracking-wider focus:outline-none focus:border-primary transition-all placeholder:text-text-tertiary font-sans"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 rounded-none bg-primary text-white text-xs uppercase tracking-widest font-semibold hover:bg-primary-dark transition-all duration-200"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-none border text-xs uppercase tracking-widest font-semibold transition-all duration-200 ${
              showFilters ? 'bg-primary border-primary text-white' : 'border-border-base bg-bg-surface text-text-secondary hover:border-text-secondary'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </form>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-6 space-y-6 border-b border-border-base pb-6">
                
                {/* Category Pills */}
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleCategoryChange(cat)}
                      className={`px-4 py-2 rounded-none text-xs font-bold uppercase tracking-wider transition-all border ${
                        category === cat
                          ? 'bg-primary border-primary text-white'
                          : 'bg-bg-surface border-border-base text-text-secondary hover:border-text-secondary'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Price Range */}
                <div className="flex flex-wrap items-center gap-4 bg-bg-tertiary/20 p-4 border border-border-base rounded-none">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary text-xs font-mono">$</span>
                    <input
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="Min price"
                      className="w-36 pl-8 pr-3 py-2 rounded-none border border-border-base bg-bg-surface text-xs uppercase tracking-wider text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-all font-sans"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary text-xs font-mono">$</span>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Max price"
                      className="w-36 pl-8 pr-3 py-2 rounded-none border border-border-base bg-bg-surface text-xs uppercase tracking-wider text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary transition-all font-sans"
                    />
                  </div>
                  {(minPrice || maxPrice || category !== 'All') && (
                    <button
                      onClick={() => { setMinPrice(''); setMaxPrice(''); setCategory('All') }}
                      className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-text-tertiary hover:text-text-primary uppercase transition-all"
                    >
                      <X className="w-3.5 h-3.5" /> Clear Filters
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      <div>
        <p className="font-mono text-[10px] tracking-widest text-text-secondary uppercase mb-6">
          {isLoading ? 'Retrieving listings…' : `${data?.total ?? 0} lots found`}
          {submitted && <span> for <strong className="text-text-primary">"{submitted}"</strong></span>}
        </p>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 bg-bg-surface rounded-none border border-border-base animate-pulse" />
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {results.map((auction, i) => (
              <AuctionCard key={auction.id} auction={auction} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-bg-surface rounded-none border border-border-base border-dashed flex flex-col items-center">
            <p className="text-text-secondary text-xs uppercase tracking-wider font-semibold">No archival lots found</p>
            <p className="text-text-tertiary text-[10px] uppercase font-mono tracking-widest mt-2 mb-6">Try adjusting keywords or price thresholds</p>
            <button
              onClick={() => { setQuery(''); setCategory('All'); setMinPrice(''); setMaxPrice(''); setSubmitted(''); setSearchParams({}) }}
              className="px-6 py-2 bg-primary text-white text-[10px] font-bold uppercase tracking-widest hover:bg-primary-dark transition-all"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
