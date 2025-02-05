import { TaskData } from "../common/task-data.js";
import { ExtendableError } from "../util/error.js";
import { S } from "./settings.js";
import { DEFAULT_FILENAME_TEMPLATE } from "../common/settings.js";
import { parseURLEncodedFilename } from "./content-disposition.js";

class FilenameTemplateError extends ExtendableError { }

function decodePathname(pathname: string) {
	return pathname.split(/([\\/])/).map(parseURLEncodedFilename).join('')
}

class FilenameTemplateResolver {
	private data!: TaskData
	private str = ''
	private firstExpr = false

	private putURL(url?: string) {
		if (!url) { this.str = ''; return }
		try {
			const obj = new URL(url)
			this.str = (obj.host.replace(/:/g, '_') +
				decodeURIComponent(obj.pathname).replace(/[\\\/]*$/, '')) // TODO %2F
		} catch { throw new FilenameTemplateError('_URL_') }
	}

	resolve(data: TaskData) {
		this.data = data
		let ft = this.data.filenameTemplate || ''
		if (!ft || ft.endsWith('/') || ft.endsWith('\\'))
			ft += S.filenameTemplate || DEFAULT_FILENAME_TEMPLATE
		return ft.replace(/\*([\w.]*)\*/g, (_, e: string) => {
			try {
				if (!e) return '*'
				this.putURL(this.data.url)
				this.firstExpr = true
				const exprs = e.split('.')
				for (const expr of exprs) {
					const key = 'expr_' + expr.toLowerCase()
					if (!(key in this)) throw new FilenameTemplateError('_UNKNOWN_')
					void (this as any)[key]()
					this.firstExpr = false
				}
				return decodePathname(this.str)
			} catch (e) {
				if (e instanceof FilenameTemplateError) return e.message
				return '_ERROR_'
			}
		}) || '_DOWNLOAD_'
	}

	protected expr_name() {
		if (this.firstExpr && this.data.substituteFilename)
			this.str = this.data.substituteFilename
		this.str = this.str.replace(/[\\\/]*$/, '').replace(/.*[\\\/]/, '')
	}

	protected expr_base() {
		this.expr_name()
		this.str = this.str.replace(/\.[^.]*$/, '')
	}

	protected expr_ext() {
		this.expr_name()
		this.str = (this.str.match(/\.[^.]*$/) || [''])[0]
	}

	protected expr_url() { this.putURL(this.data.url) }
	protected expr_referer() { this.putURL(this.data.referrer) }

	protected expr_host() { this.str = this.str.replace(/\/.*/, '') }

	protected expr_inum() { this.str = '' + this.data.inum }

	protected expr_year() { this.str = '' + this.data.creationDate.getFullYear() }
	protected expr_month() { this.str = '' + (this.data.creationDate.getMonth() + 1) }
	protected expr_day() { this.str = '' + this.data.creationDate.getDate() }
	protected expr_hour() { this.str = '' + this.data.creationDate.getHours() }
	protected expr_minute() { this.str = '' + this.data.creationDate.getMinutes() }
	protected expr_second() { this.str = '' + this.data.creationDate.getSeconds() }

	protected expr_00() {
		while (this.str.length < 2) this.str = '0' + this.str
	}

	protected expr_text() { this.str = this.data.text || '' }
}

export function resolveFilenameTemplate(data: TaskData) {
	return new FilenameTemplateResolver().resolve(data)
}