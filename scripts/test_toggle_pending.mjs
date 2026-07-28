// Test state behavior of handleRowChange logic
const customerData = {
  products: [
    { product_id: 'p1', product_name: 'Product 1', custom_price: 100, is_visible: true, default_price: 100 },
    { product_id: 'p2', product_name: 'Product 2', custom_price: 200, is_visible: true, default_price: 200 },
    { product_id: 'p3', product_name: 'Product 3', custom_price: 300, is_visible: false, default_price: 300 },
  ]
}

let pendingEdits = {}

function handleRowChange(productId, customPrice, isVisible) {
  const orig = customerData.products.find(p => p.product_id === productId)
  const origPrice = orig ? Number(orig.custom_price || orig.default_price || 0) : 0
  const origVis = orig ? Boolean(orig.is_visible) : true
  const newPrice = Number(customPrice)
  const newVis = Boolean(isVisible)

  if (orig && origPrice === newPrice && origVis === newVis) {
    delete pendingEdits[productId]
  } else {
    pendingEdits[productId] = { custom_price: newPrice, is_visible: newVis }
  }
}

console.log('Initial pendingEdits count:', Object.keys(pendingEdits).length)

// Toggle p1 visibility (true -> false)
handleRowChange('p1', 100, false)
console.log('After toggling p1 visibility to false:', pendingEdits, 'Count:', Object.keys(pendingEdits).length)

// Toggle p2 visibility (true -> false)
handleRowChange('p2', 200, false)
console.log('After toggling p2 visibility to false:', pendingEdits, 'Count:', Object.keys(pendingEdits).length)

// Toggle p1 back to original (false -> true)
handleRowChange('p1', 100, true)
console.log('After toggling p1 back to true:', pendingEdits, 'Count:', Object.keys(pendingEdits).length)
