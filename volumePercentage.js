// @ts-check

// NAME: Volume Percent
// VERSION: 2.1.1
// DESCRIPTION: Add volume percentage to the right of the volume bar, and an entry in the settings menu to enable/dsable decimals and volume percentage.
// AUTHOR: jeroentvb (https://github.com/jeroentvb)
// CREDITS: based on original version by unknownguy2002 -- Improved by p0rtL (https://github.com/p0rtL6)

/// <reference path='./spicetify.d.ts' />

(async function volumePercent(){
	const VOLUME_BAR_WRAPPER_CLASS = '.main-nowPlayingBar-volumeBar';

    // Check if Spicetify has loaded
    const { Platform, Menu, LocalStorage } = Spicetify;
    if (!Platform || !Menu || !LocalStorage) {
        setTimeout(volumePercent, 300);
        return;
    }

    try {
        /**
         * Volume percent extension settings
         */
        /** @type {boolean} */
        let showVolumePercent = JSON.parse(LocalStorage.get('showVolumePercent')) ?? true;
        /** @type {boolean} */
        let showVolumePercentDecimals = JSON.parse(LocalStorage.get('showVolumePercentDecimals')) ?? false;

        /**
         * Get reference to volume bar wrapper element and add back original width if volume percentage is hidden
         */
        const volumeBarWrapper = await getVolumeBarWrapper();
        if (!showVolumePercent) volumeBarWrapper.classList.add('inherit-flex');

        /**
         * Create and render volume percentage element
         */
        const volumePercentageElement = await createVolumePercentageElement();
        volumeBarWrapper.append(volumePercentageElement);

        /**
         * Create and render volume percentage edit element
         */
        const volumePercentageEditElement = createVolumePercentageEditElement();
        volumeBarWrapper.append(volumePercentageEditElement);

        /**
         * Watch volumebar changes and update volumePercentageElement percentage
         */
        const volumeBar = document.querySelector(`${VOLUME_BAR_WRAPPER_CLASS} .progress-bar`);
        const observer = new MutationObserver(() => updateDisplayPercentage());
        observer.observe(volumeBar, {
            attributes: true,
            childList: true,
            subtree: true
        });

        /**
         * Add styles for the extension ui
         */
         addStylesheet();

        /**
         * Add settings menu
         */
        const menuItems = [
            new Menu.Item('Show volume percentage', showVolumePercent, (menuItem) => {
                showVolumePercent = !showVolumePercent;

                LocalStorage.set('showVolumePercent', JSON.stringify(showVolumePercent));
                menuItem.setState(showVolumePercent);

                volumePercentageElement.classList.toggle('hide');
                volumeBarWrapper.classList.toggle('inherit-flex');
            }),

            new Menu.Item('Show decimals', showVolumePercentDecimals, (menuItem) => {
                showVolumePercentDecimals = !showVolumePercentDecimals;

                LocalStorage.set('showVolumePercentDecimals', JSON.stringify(showVolumePercentDecimals));
                menuItem.setState(showVolumePercentDecimals);

                updateDisplayPercentage();
            }),
        ]

        new Menu.SubMenu('Volume percentage', menuItems).register();

        /**
         * Wait for the volume bar wrapper to exist before returning it
         * @returns {Promise<Element>}
         */
        function getVolumeBarWrapper() {
            return new Promise(resolve => {
                const elementExists = setInterval(() => {
                    const volumeBarWrapper = document.querySelector(`.main-nowPlayingBar-right ${VOLUME_BAR_WRAPPER_CLASS}`);

                    if (volumeBarWrapper) {
						clearInterval(elementExists);
						resolve(volumeBarWrapper);
                    }
                }, 100);
            })
        }
        
        /**
         * Parses the passed in or current spotify volume to a human readable percentage
         * @param {number} [volume] 
         * @returns {Promise<string>}
         */
        async function getDisplayVolumePercentage(volume) {
            if (!volume) volume = await Platform.PlaybackAPI.getVolume();

            const volumePercentage = volume * 100;
            const roundedPercentage = showVolumePercentDecimals
                ? Math.round(volumePercentage * 100) / 100 // Rounds to 2 decimals
                : Math.round(volumePercentage); // Round without decimals

            return `${roundedPercentage}%`;
        }

        async function updateDisplayPercentage() {
            volumePercentageElement.textContent = await getDisplayVolumePercentage();
        }

        /**
         * Create the paragraph that will show the volume percentage
         * @returns {Promise<HTMLButtonElement>}
         */
        async function createVolumePercentageElement() {
            // Create button
            const p = document.createElement('button');
            
            p.textContent = await getDisplayVolumePercentage();
            p.setAttribute('data-tooltip', 'volume');
            p.setAttribute('id', 'volume-percentage');
            // button.setAttribute('contentEditable', 'true');

            // Hide element if settings say so
            if (!showVolumePercent) p.classList.add('hide');

            // Handle click event
            p.addEventListener('click', onVolumePercentageClick);

            return p;
        }

        /**
         * Create the input that will be used to edit the volume percentage
         * @returns {HTMLInputElement}
         */
        function createVolumePercentageEditElement() {
            // Create input
            const input = document.createElement('input');
            
            input.setAttribute('type', 'number');
            input.setAttribute('id', 'volume-percentage-edit');
            input.setAttribute('min', '0');
            input.setAttribute('max', '100');
            input.classList.add('generic-hidden');
            input.value = '';

            // Handle events
            input.addEventListener('change', onVolumeChange);
            input.addEventListener('focusout', toggleEditMode);
            input.addEventListener('keydown', (e) => {
                // Toggling display and edit elements is done by focusout event which is triggered by the blur function.
                if (e.key === 'Enter') input.blur();
            })

            return input;
        }

        function toggleEditMode() {
            volumePercentageElement.classList.toggle('generic-hidden');
            volumePercentageEditElement.classList.toggle('generic-hidden');
        }

        /**
         * Set edit value. Show and focus on edit element
         */
        async function onVolumePercentageClick() {
            const volume = await Platform.PlaybackAPI.getVolume();
            const roundedVolume = Math.round(volume * 100);

            volumePercentageEditElement.value = roundedVolume.toString();
            toggleEditMode();
            volumePercentageEditElement.focus();
        }

        /**
         * Update volume based on edit value
         */
        function onVolumeChange() {
            const percentage = parseFloat(volumePercentageEditElement.value.replace(/[^0-9]/g, ''));
            const volume = percentage / 100;

            if (isNaN(volume)){
                Spicetify.showNotification('Invalid input, only integers or floats accepted');
                return
            }

            Platform.PlaybackAPI.setVolume(volume);
        }

        function addStylesheet() {
            const style = document.createElement('style');
            style.textContent = `
                #volume-percentage {
                    background-color: transparent;
                    border: none;
                    flex: 0 1 100px;
                    margin-left: 1em;
                    font-size: 14px;
                }

                #volume-percentage:hover {
                    color: #fff;
                }

                #volume-percentage.hide {
                    display: none;
                }


                #volume-percentage-edit {
                    flex: 0 1 75px;
                    margin: 0 12px;
                    background-color: transparent;
                    border: none;
                    border-bottom: 1px solid #fff;
                    text-align: center;
                    font-size: 14px;
                }


                .main-nowPlayingBar-right ${VOLUME_BAR_WRAPPER_CLASS} {
                    flex-basis: 200px;
                }

                .main-nowPlayingBar-right ${VOLUME_BAR_WRAPPER_CLASS}.inherit-flex {
                    flex-basis: 125px;
                }

                
                .generic-hidden {
                    display: none;
                }

                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }

                input[type=number] {
                    -moz-appearance:textfield; /* Firefox */
                }
            `;

            document.body.appendChild(style);
        }
    } catch (err) {
        Spicetify.showNotification('An error ocurred while loading volume percentage. Check the console for more info');

        console.error(err);
    }
})()
