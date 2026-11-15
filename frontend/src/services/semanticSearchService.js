import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const searchSemanticProducts = async (query, limit = 500, categoryId = null, preferences = {}, options = {}) => {
  try {
    const params = { q: query, limit, ...options };
    if (categoryId !== null && categoryId !== undefined && categoryId !== '' && categoryId !== 'null' && categoryId !== 'all') {
      params.categoryId = categoryId;
    }
    if (preferences && Object.keys(preferences).length > 0) {
      params.preferences = JSON.stringify(preferences);
    }
    const response = await axios.get(`${API_URL}/search/semantic`, { params });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to perform semantic search');
  }
};
