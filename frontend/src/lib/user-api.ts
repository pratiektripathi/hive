import api from './axios'

export interface CurrentUser {
  id: number
  firstname: string
  lastname: string
  username: string
  theme: "light" | "dark"
}

export const getCurrentUser = async (): Promise<CurrentUser> => {
  try {
    const response = await api.get('/user/me')
    return response.data
  } catch (error) {
    console.error('Error fetching current user:', error)
    throw error
  }
}

export const updateUserTheme = async (theme: "light" | "dark"): Promise<CurrentUser> => {
  try {
    const response = await api.patch('/user/me/theme', { theme })
    return response.data
  } catch (error) {
    console.error('Error updating theme:', error)
    throw error
  }
}
