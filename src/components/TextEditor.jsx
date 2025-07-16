import { useState, useEffect, useRef } from "react";

import { CKEditor } from "@ckeditor/ckeditor5-react";
import { ClassicEditor, AccessibilityHelp, Alignment, Autoformat, AutoImage, AutoLink, Autosave, BalloonToolbar, BlockToolbar, Bold, Essentials, FontBackgroundColor, FontColor, FontFamily, FontSize, Heading, HorizontalLine, ImageBlock, ImageCaption, ImageInline, ImageInsert, ImageInsertViaUrl, ImageResize, ImageStyle, ImageTextAlternative, ImageToolbar, ImageUpload, Indent, IndentBlock, Italic, Link, List, Paragraph, RemoveFormat, SelectAll, SimpleUploadAdapter, Strikethrough, TextTransformation, Underline, Undo, FindNextCommand } from "ckeditor5";

import translations from "ckeditor5/translations/fr.js";
import "ckeditor5/ckeditor5.css";
import "./TextEditor.css";

export default function TextEditor({ onSend }) {
	const editorContainerRef = useRef(null);
	const editorRef = useRef(null);
	const [editorData, setEditorData] = useState('<h1 style="text-align: center">Bonjour</h1>');
	const [isLayoutReady, setIsLayoutReady] = useState(false);
	const [buttonText, setButtonText] = useState("Envoyer");

	useEffect(() => {
		setIsLayoutReady(true);
		return () => setIsLayoutReady(false);
	}, []);

	const editorConfig = {
		toolbar: {
			items: ["undo", "redo", "|", "selectAll", "|", "heading", "|", "alignment:left", "alignment:right", "alignment:center", "alignment:justify", "|", "fontSize", "fontFamily", "fontColor", "fontBackgroundColor", "|", "bold", "italic", "underline", "strikethrough", "removeFormat", "|", "horizontalLine", "link", "insertImage", "|", "bulletedList", "numberedList", "outdent", "indent", "|", "accessibilityHelp"],
			shouldNotGroupWhenFull: false
		},
		plugins: [AccessibilityHelp, Alignment, Autoformat, AutoImage, AutoLink, Autosave, BalloonToolbar, BlockToolbar, Bold, Essentials, FontBackgroundColor, FontColor, FontFamily, FontSize, Heading, HorizontalLine, ImageBlock, ImageCaption, ImageInline, ImageInsert, ImageInsertViaUrl, ImageResize, ImageStyle, ImageTextAlternative, ImageToolbar, ImageUpload, Indent, IndentBlock, Italic, Link, List, Paragraph, RemoveFormat, SelectAll, SimpleUploadAdapter, Strikethrough, TextTransformation, Underline, Undo],
		balloonToolbar: ["bold", "italic", "|", "link", "insertImage", "|", "bulletedList", "numberedList"],
		blockToolbar: ["fontSize", "fontColor", "fontBackgroundColor", "|", "bold", "italic", "|", "link", "insertImage", "|", "bulletedList", "numberedList", "outdent", "indent"],
		fontFamily: {
			supportAllValues: true
		},
		fontSize: {
			options: [10, 12, 14, "default", 18, 20, 22],
			supportAllValues: true
		},
		heading: {
			options: [
				{
					model: "paragraph",
					title: "Paragraph",
					class: "ck-heading_paragraph"
				},
				{
					model: "heading1",
					view: "h1",
					title: "Heading 1",
					class: "ck-heading_heading1"
				},
				{
					model: "heading2",
					view: "h2",
					title: "Heading 2",
					class: "ck-heading_heading2"
				},
				{
					model: "heading3",
					view: "h3",
					title: "Heading 3",
					class: "ck-heading_heading3"
				},
				{
					model: "heading4",
					view: "h4",
					title: "Heading 4",
					class: "ck-heading_heading4"
				},
				{
					model: "heading5",
					view: "h5",
					title: "Heading 5",
					class: "ck-heading_heading5"
				},
				{
					model: "heading6",
					view: "h6",
					title: "Heading 6",
					class: "ck-heading_heading6"
				}
			]
		},
		image: {
			toolbar: ["toggleImageCaption", "imageTextAlternative", "|", "imageStyle:inline", "imageStyle:wrapText", "imageStyle:breakText", "|", "resizeImage"]
		},
		initialData: editorData,
		language: "fr",
		link: {
			addTargetToExternalLinks: true,
			defaultProtocol: "https://",
			decorators: {
				toggleDownloadable: {
					mode: "manual",
					label: "Downloadable",
					attributes: {
						download: "file"
					}
				}
			}
		},
		placeholder: "Ecrivez ici",
		translations: [translations]
	};

	return (
		<div>
			<div className='main-container'>
				<div className='editor-container editor-container_classic-editor editor-container_include-block-toolbar' ref={editorContainerRef}>
					<div className='editor-container__editor'>
						<div ref={editorRef}>
							{isLayoutReady && (
								<CKEditor
									editor={ClassicEditor}
									config={editorConfig}
									onChange={(event, editor) => {
										setEditorData(editor.getData());
									}}
								/>
							)}
						</div>
					</div>
				</div>
			</div>
			<div className='margin-t-20 center'>
				<button
					onClick={async () => {
						setButtonText("En cours..");

						try {
							await onSend(editorData);
							setButtonText("Mail envoyé");
						} catch (err) {
							setButtonText("Une erreur s'est produite");
						} finally {
							setTimeout(() => {
								setButtonText("Envoyer");
							}, 3000);
						}
					}}>
					{buttonText}
				</button>
			</div>
		</div>
	);
}
