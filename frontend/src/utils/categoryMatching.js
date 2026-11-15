/**
 * SmartChoice Category & Search Matching Utilities
 * Authoritative helpers for category isolation and product-name keyword search.
 */

// Helper to check if product belongs to the selected category
export const matchesSelectedCategory = (product, selectedCategoryId, currentCategory = null) => {
  if (selectedCategoryId === null || selectedCategoryId === undefined || selectedCategoryId === 'all') return true;
  if (!product) return false;

  const targetId = Number(selectedCategoryId);
  const pCatId = product.category_id ?? product.catalog?.categoryId ?? product.identity?.categoryId;
  if (pCatId !== undefined && pCatId !== null && Number(pCatId) === targetId) {
    return true;
  }

  // Name fallback if currentCategory is provided
  if (currentCategory?.category_name) {
    const targetName = currentCategory.category_name.toLowerCase().trim();
    const pCatName = (
      product.category_name ||
      product.catalog?.categoryName ||
      (Array.isArray(product.identity?.categories) ? product.identity.categories[0] : '') ||
      ''
    ).toLowerCase().trim();

    if (pCatName && (pCatName === targetName || targetName.includes(pCatName) || pCatName.includes(targetName))) {
      return true;
    }
  }

  return false;
};

// Helper to check if product matches search query (Product Name & Brand Only - never ingredients)
export const matchesSearchQuery = (product, query) => {
  if (!query || !query.trim()) return true;
  if (!product) return false;

  const q = query.toLowerCase().trim();
  const qClean = q.replace(/['’]/g, '');

  const name = (product.product_name || product.catalog?.productName || product.identity?.name || '').toLowerCase();
  const brand = (product.brand || product.catalog?.brand || product.identity?.brand || '').toLowerCase();

  const nameClean = name.replace(/['’]/g, '');
  const brandClean = brand.replace(/['’]/g, '');

  return (
    nameClean.includes(qClean) ||
    brandClean.includes(qClean)
  );
};
