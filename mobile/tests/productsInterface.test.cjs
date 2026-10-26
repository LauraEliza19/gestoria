const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(
    path.join(root, relativePath),
    'utf8'
  )
}

const types = read(
  'src/features/products/productTypes.ts'
)
const service = read(
  'src/features/products/services/productService.ts'
)
const hook = read(
  'src/features/products/useProducts.ts'
)
const screen = read(
  'src/features/products/screens/ProductsScreen.tsx'
)
const route = read(
  'src/app/(app)/products.tsx'
)
const layout = read(
  'src/app/(app)/_layout.tsx'
)
const modules = read(
  'src/features/modules/screens/ModulesScreen.tsx'
)
const home = read(
  'src/features/home/screens/HomeScreen.tsx'
)
const alerts = read(
  'src/features/alerts/screens/AlertsScreen.tsx'
)
const entryScreen = read(
  'src/features/products/screens/ProductEntryScreen.tsx'
);

const entryRoute = read(
  'src/app/(app)/product-entry.tsx'
);

test('products mobile matches the backend contract', () => {
  for (const field of [
    'organization_id',
    'stock_quantity',
    'min_stock_quantity',
    'product_type',
    'unit_of_measure',
    'cost_price',
    'perishable',
    'shelf_life_days',
    'ncm_code',
    'cest_code',
    'fiscal_origin',
    'recipe_id',
  ]) {
    assert.ok(
      types.includes(field),
      `missing product field: ${field}`
    )
  }

  assert.match(types, /Estoque baixo/)
  assert.match(types, /ProductCategory/)
  assert.match(types, /ProductStatus/)
})

test('products service uses the authenticated API', () => {
  assert.match(
    service,
    /apiFetch<Product\[\]>\('\/api\/products'\)/
  )
  assert.match(service, /listProducts/)
  assert.match(service, /createProduct/)
  assert.match(service, /method:\s*'POST'/)
  assert.match(service, /updateProduct/)
  assert.match(service, /method:\s*'PATCH'/)
  assert.match(service, /getProduct/);
  assert.match(service, /products\.find/);
  assert.match(service, /item\.id === productId/);
  assert.match(service, /deleteProduct/)
  assert.match(service, /method:\s*'DELETE'/)
})

test('products hook supports loading refresh retry and errors', () => {
  assert.match(hook, /listProducts\(\)/)
  assert.match(hook, /setRefreshing\(true\)/)
  assert.match(hook, /setError\(getErrorMessage/)
  assert.match(hook, /const retry = useCallback/)
  assert.match(hook, /const refresh = useCallback/)
})

test('products screen exposes real catalog controls', () => {
  assert.match(screen, /useProducts/)
  assert.match(screen, /<FlatList/)
  assert.match(screen, /<TextInput/)
  assert.match(screen, /RefreshControl/)
  assert.match(screen, /Estoque crítico/)
  assert.match(screen, /readableContentWidth/)
  assert.match(screen, /Nenhum produto encontrado/)
})

test('products mobile can create a catalog item', () => {
  assert.match(entryScreen, /createProduct/);
  assert.match(entryScreen, /handleSubmit/);
  assert.match(
    entryScreen,
    /parseNonNegativeDecimal/
  );
  assert.match(
    entryScreen,
    /router\.replace\('\/products'\)/
  );
  assert.match(entryScreen, /saving/);
  assert.match(
    entryRoute,
    /ProductEntryScreen as default/
  );
  assert.match(
    layout,
    /name="product-entry"/
  );
  assert.match(
    screen,
    /router\.push\('\/product-entry'\)/
  );
});

test('products is reachable without adding a tab item', () => {
  assert.match(route, /ProductsScreen as default/)
  assert.match(layout, /name="products"/)
  assert.match(modules, /route:\s*'\/products'/)
  assert.match(modules, /title:\s*'Produtos'/)
})

test('stock alerts open the products module', () => {
  assert.match(
    home,
    /item\.action_route === '\/products'/
  )
  assert.match(
    home,
    /router\.push\('\/products'\)/
  )
  assert.match(
    alerts,
    /item\.action_route === '\/products'/
  )
  assert.match(
    alerts,
    /router\.push\('\/products'\)/
  )
})
test('products mobile can edit a catalog item', () => {
  assert.match(
    screen,
    /pathname:\s*'\/product-entry'/
  )
  assert.match(
    screen,
    /id:\s*item\.id/
  )
  assert.match(
    entryScreen,
    /useLocalSearchParams/
  )
  assert.match(
    entryScreen,
    /getProduct\(productId\)/
  )
  assert.match(
    entryScreen,
    /updateProduct\(productId,\s*payload\)/
  )
  assert.match(entryScreen, /isEditing/)
  assert.match(
    entryScreen,
    /Salvar alterações/
  )
})
