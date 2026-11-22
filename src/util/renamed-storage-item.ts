/**
 * Reads a browser storage item saved under an older key until its value has moved to the new key, so a renamed key
 * keeps what was saved under the old one. The old key is removed once the new key holds the value.
 */
const getRenamedStorageItem = (storage: Storage, key: string, oldKey: string): string | null => {
  const value = storage.getItem(key)
  const oldValue = storage.getItem(oldKey)

  if (oldValue == null) return value

  if (value == null) {
    storage.setItem(key, oldValue)
  }

  storage.removeItem(oldKey)

  return value ?? oldValue
}

export default getRenamedStorageItem
