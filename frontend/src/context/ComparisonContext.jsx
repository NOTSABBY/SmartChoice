import React, { createContext, useContext, useState, useEffect } from 'react';

const ComparisonContext = createContext();

export const useComparison = () => {
  const context = useContext(ComparisonContext);
  if (!context) {
    return {
      compareList: [],
      comparisonProducts: [],
      addProduct: () => false,
      removeProduct: () => {},
      hasProduct: () => false,
      clearProducts: () => {},
      clearComparison: () => {},
      getCanonicalId: () => null
    };
  }
  return context;
};

export const ComparisonProvider = ({ children }) => {
  const [compareList, setCompareList] = useState(() => {
    const saved = sessionStorage.getItem('smartchoice_compare');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    sessionStorage.setItem('smartchoice_compare', JSON.stringify(compareList));
  }, [compareList]);

  // Helper to extract canonical product ID across both Catalog-500 and MongoDB schemas
  const getCanonicalId = (item) => {
    if (!item) return null;
    if (typeof item === 'string') return item;
    return item.product_id || item.productId || item.catalog?.productId || item._id || item.id || item.identity?.barcode || null;
  };

  const addProduct = (product) => {
    const newId = getCanonicalId(product);
    if (!newId) return false;

    if (compareList.length >= 4) {
      alert('You can compare up to 4 products at a time.');
      return false;
    }

    const alreadyExists = compareList.some(p => {
      const pId = getCanonicalId(p);
      return pId === newId || String(pId) === String(newId);
    });

    if (!alreadyExists) {
      setCompareList(prev => [...prev, product]);
      return true;
    }
    return false;
  };

  const removeProduct = (productIdOrProduct) => {
    const targetId = getCanonicalId(productIdOrProduct);
    if (!targetId) return;
    setCompareList(prev => prev.filter(p => {
      const pId = getCanonicalId(p);
      return pId !== targetId && String(pId) !== String(targetId);
    }));
  };

  const clearProducts = () => {
    setCompareList([]);
  };

  const hasProduct = (productIdOrProduct) => {
    const targetId = getCanonicalId(productIdOrProduct);
    if (!targetId) return false;
    return compareList.some(p => {
      const pId = getCanonicalId(p);
      return pId === targetId || String(pId) === String(targetId);
    });
  };

  const getProductCount = () => {
    return compareList.length;
  };

  return (
    <ComparisonContext.Provider value={{
      compareList,
      comparisonProducts: compareList,
      addProduct,
      removeProduct,
      clearProducts,
      clearComparison: clearProducts,
      hasProduct,
      getProductCount,
      getCanonicalId
    }}>
      {children}
    </ComparisonContext.Provider>
  );
};
