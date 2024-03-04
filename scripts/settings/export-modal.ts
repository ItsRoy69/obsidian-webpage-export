import { ButtonComponent, Modal, Setting, TFile } from 'obsidian';
import { Utils } from '../utils/utils';
import HTMLExportPlugin from '../main';
import { ExportPreset, Settings, SettingsPage } from './settings';
import { FilePickerTree } from '../component-generators/file-picker';
import { Path } from 'scripts/utils/path';
import { FileDialogs } from 'scripts/utils/file-dialogs';

export interface ExportInfo
{
	canceled: boolean;
	pickedFiles: TFile[];
	exportPath: Path;
	validPath: boolean;
}

export class ExportModal extends Modal 
{
	private isClosed: boolean = true;
	private canceled: boolean = true;
	private filePickerModalEl: HTMLElement;
	private filePicker: FilePickerTree;
	private pickedFiles: TFile[] | undefined = undefined;
	private validPath: boolean = true;
	public static title: string = "Export to HTML";

	public exportInfo: ExportInfo;

	constructor() {
		super(app);
	}

	overridePickedFiles(files: TFile[])
	{
		this.pickedFiles = files;
	}

	/**
	 * @brief Opens the modal and async blocks until the modal is closed.
	 * @returns True if the EXPORT button was pressed, false is the export was canceled.
	 * @override
	*/
	async open(): Promise<ExportInfo> 
	{
		this.isClosed = false;
		this.canceled = true;

		super.open();

		if(!this.filePickerModalEl)
		{
			this.filePickerModalEl = this.containerEl.createDiv({ cls: 'modal' });
			this.containerEl.insertBefore(this.filePickerModalEl, this.modalEl);
			this.filePickerModalEl.style.position = 'relative';
			this.filePickerModalEl.style.zIndex = "1";
			this.filePickerModalEl.style.width = "25em";
			this.filePickerModalEl.style.padding = "0";
			this.filePickerModalEl.style.margin = "10px";
			this.filePickerModalEl.style.maxHeight = "80%";
			this.filePickerModalEl.style.boxShadow = "0 0 7px 1px inset #00000060";
			
			let scrollArea = this.filePickerModalEl.createDiv({ cls: 'tree-scroll-area' });
			scrollArea.style.height = "100%";
			scrollArea.style.width = "100%";
			scrollArea.style.overflowY = "auto";
			scrollArea.style.overflowX = "hidden";
			scrollArea.style.padding = "1em";
			scrollArea.style.boxShadow = "0 0 7px 1px inset #00000060";

			let paths = app.vault.getFiles().map(file => new Path(file.path));
			this.filePicker = new FilePickerTree(paths, true, true);
			this.filePicker.regexBlacklist.push(...Settings.filePickerBlacklist);
			this.filePicker.regexBlacklist.push(...[Settings.customHeadContentPath, Settings.faviconPath]);
			this.filePicker.regexWhitelist.push(...Settings.filePickerWhitelist);
			
			this.filePicker.generateWithItemsClosed = true;
			this.filePicker.showFileExtentionTags = true;
			this.filePicker.hideFileExtentionTags = ["md"];
			this.filePicker.title = "Select Files to Export";
			this.filePicker.class = "file-picker";
			await this.filePicker.insert(scrollArea);
			
			if((this.pickedFiles?.length ?? 0 > 0) || Settings.filesToExport[0].length > 0) 
			{
				let filesToPick = this.pickedFiles?.map(file => file.path) ?? Settings.filesToExport[0];
				this.filePicker.setSelectedFiles(filesToPick);
			}

			let saveFiles = new Setting(this.filePickerModalEl).addButton((button) => 
			{
				button.setButtonText("Save").onClick(async () =>
				{
					Settings.filesToExport[0] = this.filePicker.getSelectedFilesSavePaths();
					await SettingsPage.saveSettings();
				});
			});

			saveFiles.settingEl.style.border = "none";
			saveFiles.settingEl.style.marginRight = "1em";
		}


		const { contentEl } = this;

		contentEl.empty();

		this.titleEl.setText(ExportModal.title);

		if (HTMLExportPlugin.updateInfo.updateAvailable) 
		{
			// create red notice showing the update is available
			let updateNotice = contentEl.createEl('strong', { text: `Update Available: ${HTMLExportPlugin.updateInfo.currentVersion} ⟶ ${HTMLExportPlugin.updateInfo.latestVersion}` });
			updateNotice.setAttribute("style",
				`margin-block-start: calc(var(--h3-size)/2);
			background-color: var(--interactive-normal);
			padding: 4px;
			padding-left: 1em;
			padding-right: 1em;
			color: var(--color-red);
			border-radius: 5px;
			display: block;
			width: fit-content;`)

			// create normal block with update notes
			let updateNotes = contentEl.createEl('div', { text: HTMLExportPlugin.updateInfo.updateNote });
			updateNotes.setAttribute("style",
				`margin-block-start: calc(var(--h3-size)/2);
			background-color: var(--background-secondary-alt);
			padding: 4px;
			padding-left: 1em;
			padding-right: 1em;
			color: var(--text-normal);
			font-size: var(--font-ui-smaller);
			border-radius: 5px;
			display: block;
			width: fit-content;
			white-space: pre-wrap;`)
		}

		let modeDescriptions = 
		{
			"website": "This will export a file structure suitable for uploading to your own web server.",
			"documents": "This will export self-contained, but slow loading and large, html documents.",
			"raw-documents": "This will export raw, self-contained documents without the website layout. This is useful for sharing individual notes, or printing."
		}

		let exportModeSetting = new Setting(contentEl)
			.setName('Export Mode')
			// @ts-ignore
			.setDesc(modeDescriptions[Settings.exportPreset] + "\n\nSome options are only available in certain modes.")
			.setHeading()
			.addDropdown((dropdown) => dropdown
				.addOption('website', 'Online Web Server')
				.addOption('documents', 'HTML Documents')
				.addOption('raw-documents', 'Raw HTML Documents')
				.setValue(["website", "documents", "raw-documents"].contains(Settings.exportPreset) ? Settings.exportPreset : 'website')
				.onChange(async (value) =>
				{
					Settings.exportPreset = value as ExportPreset;

					switch (value) {
						case 'website':
							await Settings.websitePreset();
							break;
						case 'documents':
							await Settings.documentsPreset();
							break;
						case 'raw-documents':
							await Settings.rawDocumentsPreset();
							break;
					}

					this.open();
				}
				));
		exportModeSetting.descEl.style.whiteSpace = "pre-wrap";

		SettingsPage.createToggle(contentEl, "Open after export", () => Settings.openAfterExport, (value) => Settings.openAfterExport = value);
		
		let exportButton : ButtonComponent | undefined = undefined;

		function setExportDisabled(disabled: boolean)
		{
			if(exportButton) 
			{
				exportButton.setDisabled(disabled);
				if (exportButton.disabled) exportButton.buttonEl.style.opacity = "0.5";
				else exportButton.buttonEl.style.opacity = "1";
			}
		}

		let validatePath = (path: Path) => path.validate(
			{
				allowEmpty: false,
				allowRelative: false,
				allowAbsolute: true,
				allowDirectories: true,
				allowTildeHomeDirectory: true,
				requireExists: true
			});

		let onChanged = (path: Path) => (!validatePath(path).valid) ? setExportDisabled(true) : setExportDisabled(false);

		let exportPathInput = SettingsPage.createFileInput(contentEl, () => Settings.exportPath, (value) => Settings.exportPath = value,
		{
			name: '',
			description: '',
			placeholder: 'Type or browse an export directory...',
			defaultPath: FileDialogs.idealDefaultPath(),
			pickFolder: true,
			validation: validatePath,
			onChanged: onChanged
		});

		let { fileInput } = exportPathInput;
		
		fileInput.addButton((button) => {
			exportButton = button;
			setExportDisabled(!this.validPath);
			button.setButtonText('Export').onClick(async () => 
			{
				this.canceled = false;
				this.close();
			});
		});

		onChanged(new Path(Settings.exportPath));

		new Setting(contentEl)
			.setDesc("More options located on the plugin settings page.")
			.addExtraButton((button) => button.setTooltip('Open plugin settings').onClick(() => {
				//@ts-ignore
				app.setting.open();
				//@ts-ignore
				app.setting.openTabById('webpage-html-export');
		}));

		this.filePickerModalEl.style.height = this.modalEl.clientHeight * 2 + "px";

		await Utils.waitUntil(() => this.isClosed, 60 * 60 * 1000, 10);
		
		this.pickedFiles = this.filePicker.getSelectedFiles();
		this.filePickerModalEl.remove();
		this.exportInfo = { canceled: this.canceled, pickedFiles: this.pickedFiles, exportPath: new Path(Settings.exportPath), validPath: this.validPath};

		return this.exportInfo;
	}

	onClose() 
	{
		const { contentEl } = this;
		contentEl.empty();
		this.isClosed = true;
		ExportModal.title = "Export to HTML";
	}
}
