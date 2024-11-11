<script>
	export let text = 'From';
	export let color = '#79aa38';
</script>

<div
	style="position: relative; display: flex; flex-direction: column; align-items: center; font-family: Arial, sans-serif;"
>
	<div
		style="font-size: 14px; color: #ffffff; background-color: #79aa38; border-radius: 8px; padding: 6px 10px; margin-bottom: 6px; box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.2);"
	>
		{text}
	</div>
	<svg
		width="40"
		height="40"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		style="background-color: #ffffff; border-radius: 50%; padding: 8px; box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.2);"
	>
		<path
			d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z"
			fill={color}
			stroke="#333"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
</div>
