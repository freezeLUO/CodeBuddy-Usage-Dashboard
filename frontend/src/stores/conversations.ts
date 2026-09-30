import { defineStore } from 'pinia'
import { http } from '@/api/client'
import type { ConversationDetail, ConversationList } from '@/api/types'
import { useFiltersStore } from './filters'

export const useConversationsStore = defineStore('conversations', {
  state: () => ({
    items: [] as ConversationList['items'],
    total: 0,
    page: 1,
    size: 20,
    keyword: '',
    sort: 'ended_at_ms',
    order: 'desc' as 'asc' | 'desc',
    loading: false,
    detail: null as ConversationDetail | null,
    detailLoading: false,
  }),
  actions: {
    async fetch() {
      const filters = useFiltersStore()
      this.loading = true
      try {
        const { data } = await http.get<ConversationList>('/conversations', {
          params: {
            ...filters.params,
            page: this.page,
            size: this.size,
            q: this.keyword || undefined,
            sort: this.sort,
            order: this.order,
          },
        })
        this.items = data.items
        this.total = data.total
        if (!data.items.length && this.page > 1) {
          this.page = 1
          await this.fetch()
        }
      } finally {
        this.loading = false
      }
    },
    async openDetail(conversationId: string) {
      const filters = useFiltersStore()
      this.detailLoading = true
      this.detail = null
      try {
        const { data } = await http.get<ConversationDetail>(
          `/conversations/${conversationId}`,
          { params: filters.params },
        )
        this.detail = data
      } finally {
        this.detailLoading = false
      }
    },
    closeDetail() {
      this.detail = null
    },
  },
})
