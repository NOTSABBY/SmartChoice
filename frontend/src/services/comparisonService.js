import axios from 'axios';

const API_URL = 'http://localhost:8080/api';

export const compareProducts = async (productIds, preferences = {}) => {
  const response = await axios.post(`${API_URL}/compare`, { productIds, preferences });
  return response.data;
};

export const getSimilarProducts = async (productId) => {
  const response = await axios.get(`${API_URL}/products/${productId}/similar`);
  return response.data;
};
