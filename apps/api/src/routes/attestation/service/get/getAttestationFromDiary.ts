import type { AttestationResponse } from '@diary-spo/shared'

import { SERVER_URL } from '@config'
import type { ICacheData } from '@helpers'
import { HeadersWithCookie } from '@utils'
import ky from 'ky'

export const getAttestationFromDiary = async (
  authData: ICacheData
): Promise<AttestationResponse> => {
  const path = `${SERVER_URL}/app/school/reports/studentaveragemark`

  return ky
    .get(path, {
      headers: HeadersWithCookie(authData.cookie)
    })
    .json()
}
