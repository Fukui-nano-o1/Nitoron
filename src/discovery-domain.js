import { countFilters, EMPTY_FILTERS } from './search.js'

// Only the unfiltered first page is a browse landing page; deep links keep their results.
export const isDiscoveryHome = ({ query = '', region = '', filters = EMPTY_FILTERS, sort = 'recent', page = 0 } = {}) => !query.trim() && !region.trim() && countFilters(filters) === 0 && sort === 'recent' && page === 0
