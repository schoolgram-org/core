import { date, timedelta } from 'date-fns';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { Optional, Dict, List, Union } from 'typescript-collections';

import httpx from 'httpx';
import { AsyncClient, Response } from 'httpx';

import { errors, schemas } from 'netschoolapi';

export class NetSchoolAPI {
    private _wrapped_client: AsyncClientWrapper;
    private _student_id: number = -1;
    private _year_id: number = -1;
    private _school_id: number = -1;
    private _assignment_types: Dict<number, string> = new Dict();
    private _login_data: [string, string, Union<number, string>] | null = null;
    private _access_token: string | null = null;

    constructor(url: string, default_requests_timeout: number | null = null) {
        url = url.replace(/\/$/, '');
        this._wrapped_client = new AsyncClientWrapper(
            new AsyncClient({
                baseURL: `${url}/webapi`,
                headers: { 'user-agent': 'NetSchoolAPI/5.0.3', 'referer': url },
                eventHooks: { response: [_die_on_bad_status] },
            }),
            default_requests_timeout
        );
    }

    async _die_on_bad_status(response: Response) {
        if (!response.isRedirect) {
            response.raiseForStatus();
        }
    }

    async login(
        user_name: string,
        password: string,
        school_name_or_id: Union<number, string>,
        requests_timeout: number | null = null
    ) {
        const requester = this._wrapped_client.make_requester(requests_timeout);
        await requester(this._wrapped_client.client.build_request({
            method: "GET",
            url: "logindata"
        }));

        const response = await requester(this._wrapped_client.client.build_request({
            method: "POST",
            url: 'auth/getdata'
        }));
        const login_meta = response.json();
        const salt = login_meta.pop('salt');

        const encoded_password = createHash('md5')
            .update(Buffer.from(password, 'windows-1251'))
            .digest('hex');
        const pw2 = createHash('md5')
            .update(salt + encoded_password)
            .digest('hex');
        const pw = pw2.slice(0, password.length);

        try {
            const response = await requester(this._wrapped_client.client.build_request({
                method: "POST",
                url: 'login',
                data: {
                    'loginType': 1,
                    'scid': (typeof school_name_or_id === 'string') ?
                        await this._get_school_id(school_name_or_id, requester) :
                        school_name_or_id,
                    'un': user_name,
                    'pw': pw,
                    'pw2': pw2,
                    ...login_meta,
                },
            }));
        } catch (http_status_error) {
            if (http_status_error.response.status_code === httpx.codes.CONFLICT) {
                const response_json = await http_status_error.response.json();
                if ('message' in response_json) {
                    throw new errors.AuthError(response_json['message']);
                }
                throw new errors.AuthError();
            } else {
                throw http_status_error;
            }
        }
        const auth_result = response.json();

        if (!('at' in auth_result)) {
            throw new errors.AuthError(auth_result['message']);
        }

        this._access_token = auth_result["at"];
        this._wrapped_client.client.headers['at'] = auth_result['at'];

        const diary_response = await requester(this._wrapped_client.client.build_request({
            method: "GET",
            url: 'student/diary/init',
        }));
        const diary_info = diary_response.json();
        const student = diary_info['students'][diary_info['currentStudentId']];
        this._student_id = student['studentId'];

        const year_response = await requester(this._wrapped_client.client.build_request({
            method: "GET",
            url: 'years/current'
        }));
        const year_reference = year_response.json();
        this._year_id = year_reference['id'];

        const assignment_response = await requester(this._wrapped_client.client.build_request({
            method: "GET",
            url: "grade/assignment/types",
            params: { "all": false },
        }));
        const assignment_reference = assignment_response.json();
        this._assignment_types = new Dict<number, string>(
            assignment_reference.map(assignment => [assignment['id'], assignment['name']])
        );
        this._login_data = [user_name, password, school_name_or_id];
    }

    async _request_with_optional_relogin(
        requests_timeout: number | null,
        request: httpx.Request,
        follow_redirects: boolean = false
    ) {
        try {
            return await this._wrapped_client.request(requests_timeout, request, follow_redirects);
        } catch (http_status_error) {
            if (http_status_error.response.status_code === httpx.codes.UNAUTHORIZED) {
                if (this._login_data) {
                    await this.login(...this._login_data);
                    return await this._request_with_optional_relogin(requests_timeout, request, follow_redirects);
                } else {
                    throw new errors.AuthError(".login() before making requests that need authorization");
                }
            } else {
                throw http_status_error;
            }
        }
    }

    async download_attachment(
        attachment_id: number,
        buffer: Readable,
        requests_timeout: number | null = null
    ) {
        const response = await this._request_with_optional_relogin(
            requests_timeout,
            this._wrapped_client.client.build_request({
                method: "GET",
                url: `attachments/${attachment_id}`,
            })
        );
        buffer.write(response.content);
    }

    async diary(
        start: Optional<date> = null,
        end: Optional<date> = null,
        requests_timeout: number | null = null
    ): Promise<schemas.Diary> {
        if (!start) {
            const monday = date.today() - timedelta({ days: date.today().getDay() });
            start = monday;
        }
        if (!end) {
            end = start + timedelta({ days: 5 });
        }

        const response = await this._request_with_optional_relogin(
            requests_timeout,
            this._wrapped_client.client.build_request({
                method: "GET",
                url: "student/diary",
                params: {
                    'studentId': this._student_id,
                    'yearId': this._year_id,
                    'weekStart': start.toISOString(),
                    'weekEnd': end.toISOString(),
                },
            })
        );
        const diary_schema = new schemas.DiarySchema();
        diary_schema.context['assignment_types'] = this._assignment_types;
        return diary_schema.load(response.json());
    }

    async overdue(
        start: Optional<date> = null,
        end: Optional<date> = null,
        requests_timeout: number | null = null
    ): Promise<List<schemas.Assignment>> {
        if (!start) {
            const monday = date.today() - timedelta({ days: date.today().getDay() });
            start = monday;
        }
        if (!end) {
            end = start + timedelta({ days: 5 });
        }

        const response = await this._request_with_optional_relogin(
            requests_timeout,
            this._wrapped_client.client.build_request({
                method: "GET",
                url: 'student/diary/pastMandatory',
                params: {
                    'studentId': this._student_id,
                    'yearId': this._year_id,
                    'weekStart': start.toISOString(),
                    'weekEnd': end.toISOString(),
                },
            })
        );
        const assignments_schema = new schemas.AssignmentSchema();
        assignments_schema.context['assignment_types'] = this._assignment_types;
        return assignments_schema.load(response.json(), true);
    }

    async announcements(
        take: Optional<number> = -1,
        requests_timeout: number | null = null
    ): Promise<List<schemas.Announcement>> {
        const response = await this._request_with_optional_relogin(
            requests_timeout,
            this._wrapped_client.client.build_request({
                method: "GET",
                url: "announcements",
                params: { "take": take },
            })
        );
        return schemas.AnnouncementSchema().load(response.json(), true);
    }

    async attachments(
        assignment_id: number,
        requests_timeout: number | null = null
    ): Promise<List<schemas.Attachment>> {
        const response = await this._request_with_optional_relogin(
            requests_timeout,
            this._wrapped_client.client.build_request({
                method: "POST",
                url: 'student/diary/get-attachments',
                params: { 'studentId': this._student_id },
                json: { 'assignId': [assignment_id] },
            }),
        );
        const attachments_json = response.json();
        if (!attachments_json.length) {
            return [];
        }
        const attachments = schemas.AttachmentSchema().load(attachments_json[0]['attachments'], true);
        return attachments;
    }

    async school(requests_timeout: number | null = null): Promise<schemas.School> {
        const response = await this._request_with_optional_relogin(
            requests_timeout,
            this._wrapped_client.client.build_request({
                method: "GET",
                url: `schools/${this._school_id}/card`,
            })
        );
        return schemas.SchoolSchema().load(response.json());
    }

    async logout(requests_timeout: number | null = null) {
        try {
            await this._wrapped_client.request(
                requests_timeout,
                this._wrapped_client.client.build_request({
                    method: "POST",
                    url: 'auth/logout',
                })
            );
        } catch (http_status_error) {
            if (http_status_error.response.status_code === httpx.codes.UNAUTHORIZED) {
                // Session is dead => we are logged out already
                // OR
                // We are logged out already
                return;
            } else {
                throw http_status_error;
            }
        }
    }

    async full_logout(requests_timeout: number | null = null) {
        await this.logout(requests_timeout);
        await this._wrapped_client.client.aclose();
    }

    async schools(requests_timeout: number | null = null): Promise<List<schemas.ShortSchool>> {
        const resp = await this._wrapped_client.request(
            requests_timeout,
            this._wrapped_client.client.build_request({
                method: "GET",
                url: "schools/search?name=У",
            })
        );
        return schemas.ShortSchoolSchema().load(resp.json(), true);
    }

    async _get_school_id(
        school_name: string,
        requester: Requester
    ): Promise<number> {
        const schools = (await requester(
            this._wrapped_client.client.build_request({
                method: "GET",
                url: `schools/search?name=${school_name}`,
            })
        )).json();

        for (const school of schools) {
            if (school["shortName"] === school_name) {
                this._school_id = school['id'];
                return school["id"];
            }
        }
        throw new errors.SchoolNotFoundError(school_name);
    }

    async download_profile_picture(
        user_id: number,
        buffer: Readable,
        requests_timeout: number | null = null
    ) {
        const response = await this._request_with_optional_relogin(
            requests_timeout,
            this._wrapped_client.client.build_request({
                method: "GET",
                url: "users/photo",
                params: { "at": this._access_token, "userId": user_id },
            }),
            true
        );
        buffer.write(response.content);
    }
}

