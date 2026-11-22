/**
 * @vitest-environment jsdom
 */

import getRenamedStorageItem from '../renamed-storage-item'

describe('getRenamedStorageItem', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it.each([
    ['localStorage', () => localStorage],
    ['sessionStorage', () => sessionStorage]
  ])('moves a value saved under the old key to the new key in %s', (_, storage) => {
    storage().setItem('tltg-status.dismissed-updates', '["update-1"]')

    expect(getRenamedStorageItem(storage(), 'vo-status.dismissed-updates', 'tltg-status.dismissed-updates')).toBe('["update-1"]')
    expect(storage().getItem('vo-status.dismissed-updates')).toBe('["update-1"]')
    expect(storage().getItem('tltg-status.dismissed-updates')).toBeNull()
  })

  it('keeps the new key over the old one, and removes the old one', () => {
    localStorage.setItem('vo-addons.dismissed-jobs', '["job-2"]')
    localStorage.setItem('tltg-addons.dismissed-jobs', '["job-1"]')

    expect(getRenamedStorageItem(localStorage, 'vo-addons.dismissed-jobs', 'tltg-addons.dismissed-jobs')).toBe('["job-2"]')
    expect(localStorage.getItem('vo-addons.dismissed-jobs')).toBe('["job-2"]')
    expect(localStorage.getItem('tltg-addons.dismissed-jobs')).toBeNull()
  })

  it('returns null when neither key is saved', () => {
    expect(getRenamedStorageItem(localStorage, 'vo-addons.dismissed-jobs', 'tltg-addons.dismissed-jobs')).toBeNull()
    expect(localStorage.length).toBe(0)
  })
})
