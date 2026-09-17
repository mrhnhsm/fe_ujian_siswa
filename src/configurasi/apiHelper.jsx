import axios from "axios";
import configurasi from "./config";

// Helper function untuk membuat headers dasar
const getBaseHeaders = async () => {
  const { clientId, clientSecret } = await configurasi.getCredentials();
  // console.log(clientId, clientSecret);
  return {
    "X-Client-ID": clientId,
    "X-Client-Secret": clientSecret,
    "Content-Type": "application/json",
  };
};

// Helper function untuk membuat headers dengan Bearer Token
const getAuthHeaders = async (token) => {
  const baseHeaders = await getBaseHeaders();
  if (token) {
    return {
      ...baseHeaders,
      Authorization: `Bearer ${token}`,
    };
  }
  return baseHeaders;
};

// Helper function untuk membuat headers multipart
const getMultipartHeaders = async (token) => {
  const { clientId, clientSecret } = await configurasi.getCredentials();
  const headers = {
    "X-Client-ID": clientId,
    "X-Client-Secret": clientSecret,
    "Content-Type": "multipart/form-data",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
};

// Helper function untuk GET request (dengan Bearer Token dan Params)
export const apiGet = async (endpoint, token = null, params = null) => {
  const headers = await getAuthHeaders(token);
  const axiosConfig = { headers, withCredentials: true };

  if (params) {
    axiosConfig.params = params;
  }

  try {
    return await axios.get(`${configurasi.BASE_URL}${endpoint}`, axiosConfig);
  } catch (error) {
    if (error.response?.status === 401) {
      await configurasi.fetchClientCredentials();
      const newHeaders = await getAuthHeaders(token);
      axiosConfig.headers = newHeaders;
      return await axios.get(`${configurasi.BASE_URL}${endpoint}`, axiosConfig);
    }
    throw error;
  }
};

// Helper function untuk POST request (dengan Bearer Token dan Data)
export const apiPost = async (endpoint, token = null, data = null) => {
  const headers = await getAuthHeaders(token);

  try {
    return await axios.post(`${configurasi.BASE_URL}${endpoint}`, data, {
      headers,
      withCredentials: true,
    });
  } catch (error) {
    if (error.response?.status === 401) {
      await configurasi.fetchClientCredentials();
      const newHeaders = await getAuthHeaders(token);
      return await axios.post(`${configurasi.BASE_URL}${endpoint}`, data, {
        headers: newHeaders,
        withCredentials: true,
      });
    }
    throw error;
  }
};

// Helper function untuk PUT request (dengan Bearer Token dan Data)
export const apiPut = async (endpoint, token = null, data = null) => {
  const headers = await getAuthHeaders(token);

  try {
    return await axios.put(`${configurasi.BASE_URL}${endpoint}`, data, {
      headers,
      withCredentials: true,
    });
  } catch (error) {
    if (error.response?.status === 401) {
      await configurasi.fetchClientCredentials();
      const newHeaders = await getAuthHeaders(token);
      return await axios.put(`${configurasi.BASE_URL}${endpoint}`, data, {
        headers: newHeaders,
        withCredentials: true,
      });
    }
    throw error;
  }
};

// Helper function untuk DELETE request (dengan Bearer Token dan Params)
export const apiDelete = async (endpoint, token = null, params = null) => {
  const headers = await getAuthHeaders(token);
  const axiosConfig = { headers, withCredentials: true };

  if (params) {
    axiosConfig.params = params;
  }

  try {
    return await axios.delete(
      `${configurasi.BASE_URL}${endpoint}`,
      axiosConfig,
    );
  } catch (error) {
    if (error.response?.status === 401) {
      await configurasi.fetchClientCredentials();
      const newHeaders = await getAuthHeaders(token);
      axiosConfig.headers = newHeaders;
      return await axios.delete(
        `${configurasi.BASE_URL}${endpoint}`,
        axiosConfig,
      );
    }
    throw error;
  }
};

// Helper function untuk upload file (multipart/form-data)
export const apiPostForm = async (
  endpoint,
  formData,
  token = null,
  onUploadProgress = null,
) => {
  const headers = await getMultipartHeaders(token);
  const axiosConfig = {
    headers,
    onUploadProgress,
    withCredentials: true,
  };

  try {
    return await axios.post(
      `${configurasi.BASE_URL}${endpoint}`,
      formData,
      axiosConfig,
    );
  } catch (error) {
    if (error.response?.status === 401) {
      await configurasi.fetchClientCredentials();
      const newHeaders = await getMultipartHeaders(token);
      axiosConfig.headers = newHeaders;
      return await axios.post(
        `${configurasi.BASE_URL}${endpoint}`,
        formData,
        axiosConfig,
      );
    }
    throw error;
  }
};

// Helper function untuk PUT form data
export const apiPutForm = async (
  endpoint,
  formData,
  token = null,
  onUploadProgress = null,
) => {
  const headers = await getMultipartHeaders(token);
  const axiosConfig = {
    headers,
    onUploadProgress,
    withCredentials: true,
  };

  try {
    return await axios.put(
      `${configurasi.BASE_URL}${endpoint}`,
      formData,
      axiosConfig,
    );
  } catch (error) {
    if (error.response?.status === 401) {
      await configurasi.fetchClientCredentials();
      const newHeaders = await getMultipartHeaders(token);
      axiosConfig.headers = newHeaders;
      return await axios.put(
        `${configurasi.BASE_URL}${endpoint}`,
        formData,
        axiosConfig,
      );
    }
    throw error;
  }
};

// Helper function untuk download file
export const apiDownload = async (endpoint, token = null, params = null) => {
  const headers = await getAuthHeaders(token);
  const axiosConfig = {
    headers,
    responseType: "blob",
    withCredentials: true,
    // ✅ FIX 1: Pastikan Axios throw error untuk status HTTP non-2xx
    validateStatus: (status) => status >= 200 && status < 300,
  };

  if (params) {
    axiosConfig.params = params;
  }

  const processResponse = async (response) => {
    let contentType =
      response.headers["content-type"] || "application/octet-stream";

    // ✅ FIX 2: Cek JSON error LEBIH AWAL, sebelum proses apapun
    if (contentType.includes("application/json")) {
      let msg = "File tidak ditemukan di server";
      try {
        const text = await response.data.text();
        const json = JSON.parse(text);
        msg = json?.detail || json?.message || json?.error || msg;
      } catch (_) {}
      throw new Error(msg);
    }

    // Mapping content type berdasarkan ekstensi/kata kunci di endpoint
    const contentTypeMap = {
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      csv: "text/csv",
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      bmp: "image/bmp",
      ico: "image/x-icon",
      tiff: "image/tiff",
      avif: "image/avif",
    };

    // Jika content-type masih generik, coba deteksi dari endpoint
    if (contentType === "application/octet-stream") {
      const endpointLower = endpoint.toLowerCase();

      const matchedType = Object.entries(contentTypeMap).find(([key]) =>
        endpointLower.includes(key),
      );

      if (matchedType) {
        contentType = matchedType[1];
      } else if (
        endpointLower.includes("excel") ||
        endpointLower.includes("export")
      ) {
        contentType = contentTypeMap.xlsx;
      } else if (
        endpointLower.includes("image") ||
        endpointLower.includes("photo") ||
        endpointLower.includes("foto") ||
        endpointLower.includes("gambar") ||
        endpointLower.includes("thumbnail") ||
        endpointLower.includes("file") // ✅ FIX 3: tambah 'file' sebagai fallback gambar
      ) {
        contentType = "image/jpeg"; // default image fallback lebih umum dari png
      }
    }

    const blob = new Blob([response.data], { type: contentType });

    // ✅ FIX 4: Cek ulang apakah blob yang terbentuk sebenarnya JSON (double-check)
    if (blob.size > 0 && blob.size < 500 && contentType.startsWith("image/")) {
      try {
        const text = await blob.text();
        const json = JSON.parse(text);
        const msg =
          json?.detail ||
          json?.message ||
          json?.error ||
          "File tidak ditemukan di server";
        throw new Error(msg);
      } catch (e) {
        // Jika parse JSON gagal, berarti memang file valid → lanjut
        if (
          e.message !== "File tidak ditemukan di server" &&
          !e.message.includes("detail") &&
          !e.message.includes("message")
        ) {
          // bukan error dari JSON parse kita, lanjut normal
        } else {
          throw e;
        }
      }
    }

    if (blob.size === 0) {
      throw new Error("File yang didownload kosong");
    }

    const blobUrl = URL.createObjectURL(blob);

    return {
      blobUrl,
      blob,
      contentType,
      fileName: getFileNameFromResponse(response),
      isImage: contentType.startsWith("image/"),
      revoke: () => URL.revokeObjectURL(blobUrl),
    };
  };

  try {
    const response = await axios.get(
      `${configurasi.BASE_URL}${endpoint}`,
      axiosConfig,
    );
    return await processResponse(response);
  } catch (error) {
    // ✅ FIX 5: Jangan retry jika error bukan 401
    if (error.response?.status === 401) {
      await configurasi.fetchClientCredentials();
      axiosConfig.headers = await getAuthHeaders(token);

      const response = await axios.get(
        `${configurasi.BASE_URL}${endpoint}`,
        axiosConfig,
      );
      return await processResponse(response);
    }
    throw error;
  }
};

// Helper function untuk extract filename dari response headers
const getFileNameFromResponse = (response) => {
  const contentDisposition = response.headers["content-disposition"];
  if (contentDisposition) {
    const fileNameMatch = contentDisposition.match(
      /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
    );
    if (fileNameMatch && fileNameMatch[1]) {
      return fileNameMatch[1].replace(/['"]/g, "");
    }
  }
  return null;
};
