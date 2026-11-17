import api from './api'

const FALLBACK_CATEGORIES = [
  { id: 'trending', label: 'Trending GIFs', query: '', tint: 'slate', icon: 'chart', cover: '' },
  { id: 'hello', label: 'hello', query: 'hello', tint: 'grey', cover: '' },
  { id: 'lol', label: 'lol', query: 'lol', tint: 'grey', cover: '' },
  { id: 'love', label: 'love', query: 'love', tint: 'brown', cover: '' },
  { id: 'happy-birthday', label: 'happy birthday', query: 'happy birthday', tint: 'party', cover: '' },
  { id: 'thank-you', label: 'thank you', query: 'thank you', tint: 'blue', cover: '' },
  { id: 'yes', label: 'yes', query: 'yes', tint: 'grey', cover: '' },
  { id: 'no', label: 'no', query: 'no', tint: 'grey', cover: '' },
  { id: 'congrats', label: 'congrats', query: 'congrats', tint: 'party', cover: '' },
  { id: 'ok', label: 'ok', query: 'ok', tint: 'blue', cover: '' },
]

export function gifSearchPlaceholder(provider, t) {
  if (provider === 'klipy') return t('chatGifSearchKlipy')
  if (provider === 'giphy') return t('chatGifSearchGiphy')
  if (provider === 'tenor') return t('chatGifSearchTenor')
  if (provider === 'gifsnap') return t('chatGifSearch')
  return t('chatGifSearch')
}

export async function fetchGifCategories() {
  try {
    const { data } = await api.get('/chat/gif-categories')
    const categories = Array.isArray(data?.categories) ? data.categories : []
    return {
      provider: data?.provider || 'none',
      configured: !!data?.configured,
      categories: categories.length ? categories : FALLBACK_CATEGORIES,
    }
  } catch {
    return {
      provider: 'none',
      configured: false,
      categories: FALLBACK_CATEGORIES,
    }
  }
}

export async function fetchGifs({ q = '', limit = 24 } = {}) {
  try {
    const { data } = await api.get('/chat/gifs', {
      params: {
        q: q || undefined,
        limit,
      },
    })
    return {
      provider: data?.provider || 'none',
      configured: !!data?.configured,
      gifs: Array.isArray(data?.gifs) ? data.gifs : [],
      message: data?.message || '',
    }
  } catch (err) {
    return {
      provider: 'none',
      configured: false,
      gifs: [],
      message: err?.message || 'Could not load GIFs.',
    }
  }
}
