import { ActionTree } from 'vuex'
import { IndexableTypeArray } from 'dexie'
import { State } from './state'
import { ActionTypes, MutationTypes } from './constants'
import { snapshotDB, Snapshot } from '@/utils/database'

export const actions: ActionTree<State, State> = {
  async [ActionTypes.INIT_SNAPSHOT_DATABASE]({ commit, state }) {
    const snapshots: Snapshot[] = await snapshotDB.snapshots.orderBy('id').toArray()
    const lastSnapshot = snapshots.slice(-1)[0]

    if (lastSnapshot) {
      snapshotDB.snapshots.clear()
    }

    const newFirstSnapshot = {
      index: state.slideIndex,
      slides: state.slides,
    }
    await snapshotDB.snapshots.add(newFirstSnapshot)
    commit(MutationTypes.SET_SNAPSHOT_CURSOR, 0)
    commit(MutationTypes.SET_SNAPSHOT_LENGTH, 1)
  },

  async [ActionTypes.ADD_SNAPSHOT]({ state, commit }) {
    const allKeys = await snapshotDB.snapshots.orderBy('id').keys()

    let needDeleteKeys: IndexableTypeArray = []

    if (state.snapshotCursor >= 0 && state.snapshotCursor < allKeys.length - 1) {
      needDeleteKeys = allKeys.slice(state.snapshotCursor + 1)
    }

    const snapshot = {
      index: state.slideIndex,
      slides: state.slides,
    }
    await snapshotDB.snapshots.add(snapshot)

    let snapshotLength = allKeys.length - needDeleteKeys.length + 1

    if (snapshotLength > 20) {
      needDeleteKeys.push(allKeys[0])
      snapshotLength--
    }
    if (snapshotLength >= 2) {
      snapshotDB.snapshots.update(allKeys[snapshotLength - 2] as number, { index: state.slideIndex })
    }

    await snapshotDB.snapshots.bulkDelete(needDeleteKeys)

    commit(MutationTypes.SET_SNAPSHOT_CURSOR, snapshotLength - 1)
    commit(MutationTypes.SET_SNAPSHOT_LENGTH, snapshotLength)
  },

  async [ActionTypes.UN_DO]({ state, commit }) {
    if (state.snapshotCursor <= 0) return

    const snapshotCursor = state.snapshotCursor - 1
    const snapshots: Snapshot[] = await snapshotDB.snapshots.orderBy('id').toArray()
    const snapshot = snapshots[snapshotCursor]
    const { index, slides } = snapshot

    const slideIndex = index > slides.length - 1 ? slides.length - 1 : index

    commit(MutationTypes.SET_SLIDES, slides)
    commit(MutationTypes.UPDATE_SLIDE_INDEX, slideIndex)
    commit(MutationTypes.SET_SNAPSHOT_CURSOR, snapshotCursor)
    commit(MutationTypes.SET_ACTIVE_ELEMENT_ID_LIST, [])
  },

  async [ActionTypes.RE_DO]({ state, commit }) {
    if (state.snapshotCursor >= state.snapshotLength - 1) return

    const snapshotCursor = state.snapshotCursor + 1
    const snapshots: Snapshot[] = await snapshotDB.snapshots.orderBy('id').toArray()
    const snapshot = snapshots[snapshotCursor]
    const { index, slides } = snapshot

    const slideIndex = index > slides.length - 1 ? slides.length - 1 : index

    commit(MutationTypes.SET_SLIDES, slides)
    commit(MutationTypes.UPDATE_SLIDE_INDEX, slideIndex)
    commit(MutationTypes.SET_SNAPSHOT_CURSOR, snapshotCursor)
    commit(MutationTypes.SET_ACTIVE_ELEMENT_ID_LIST, [])
  },
}